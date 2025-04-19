import React, { useState, useEffect, useRef } from 'react';
import {
    Stack,
    Textarea,
    Button,
    ScrollArea,
    Paper,
    Text,
    Loader,
    Group,
    useMantineTheme,
    // Divider, // Keep commented if not used
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { useChatHistory, Message } from '../contexts/ChatHistoryContext';


// Define the expected API response structure for BOTH endpoints
interface ApiResponse {
    response: string;
    function_call?: {
        name: string,
        args: Record<string, string | number | boolean | []>
    }
}

function ChatbotInterface({openModal}) {
    const theme = useMantineTheme();
    const { messages, addMessage, setMessages } = useChatHistory(); // Use context
    const [currentInput, setCurrentInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestedActions, setSuggestedActions] = useState<string[]>([]);
    const navigate = useNavigate();

    const viewport = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            viewport.current?.scrollTo({
                top: viewport.current.scrollHeight,
                behavior: 'smooth',
            });
        }, 0);
    };

    // Scroll to bottom whenever messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // handleSendMessage remains the same as your provided code
    const handleSendMessage = async (messageOverride?: string) => {
        const textToSend = (messageOverride ?? currentInput).trim();
        if (!textToSend || isLoading) return;

        const userMessage: Message = { sender: 'user', text: textToSend };

        const currentHistory = [...messages]; // Capture history *before* adding the new user message
        addMessage(userMessage);
        if (!messageOverride) { setCurrentInput(''); }
        setIsLoading(true);
        setSuggestedActions([]);

        try {
            const response = await fetch("http://localhost:9000/api/chat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `bearer ${localStorage.getItem("access_token")}`,
              },
              body: JSON.stringify({
                message: textToSend,
                history: currentHistory,
              }),
            });

            if (!response.ok) {
                throw new Error(`Chat API Error: ${response.statusText} (${response.status})`);
            }

            const data: ApiResponse = await response.json();

            if (data && data.response) {
              const botMessage: Message = {
                sender: "bot",
                text: data.response,
              };
              addMessage(botMessage);
              if (data.function_call) {
                switch (data.function_call.name) {
                  case "yes_please_send_emails":
                    console.log("success");
                    openModal();
                    break;
                
                  default:
                    setSuggestedActions([])
                    break;
                }
              }

              // TEMPORARY
              switch (data.function_call?.name) {
                case "show_customers":
                  if (data.function_call.args.daysAgo) {
                    navigate(
                      `/customers?daysAgo=${data.function_call.args.daysAgo}`
                    );
                  } else {
                    navigate("/customers");
                  }
                  break;

                default:
                  break;
              }

            } else {
                 console.error("Invalid chat response format:", data);
                 const errorMessage: Message = { sender: 'bot', text: "Sorry, I received an unexpected chat response." };
                addMessage(errorMessage)
                 setSuggestedActions([]);
            }
        } catch (error) {
            console.error('Failed to send chat message:', error);
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I couldn't connect. Please try again." };
            addMessage(errorMessage)
            setSuggestedActions([]);
        } finally {
            setIsLoading(false);
        }
    };

    // handleKeyDown remains the same
    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    // handleActionClick remains the same
    const handleActionClick = async () => {
        setCurrentInput("Set email");
        handleSendMessage();
    };


    // JSX return remains the same, ensuring Text component handles newlines
    return (
      <Stack justify="space-between" h="100%">
        {/* Scrollable message area */}
        <ScrollArea style={{ flexGrow: 1, overflow: "hidden" }} h="100%" viewportRef={viewport} type="auto">
          <Stack p="md" gap="lg" >
            {/* Map over messages from context */}
            {messages.map((message, index) => (
              <Paper
                key={`${message.sender}-${index}-${message.text.substring(0, 10)}`} // Consider a more robust key if needed
                shadow="xs" radius="lg" p="sm" withBorder
                style={{
                  alignSelf: message.sender === "user" ? "flex-end" : "flex-start",
                  backgroundColor: message.sender === "user" ? theme.colors.green[0] : theme.colors.gray[1],
                  maxWidth: "80%",
                }}
              >
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{message.text}</Text>
              </Paper>
            ))}
            {isLoading && ( <Group justify="center" mt="sm"> <Loader size="sm" type="dots" /> </Group> )}

            {/* Suggested actions - rendering logic remains the same */}
            {!isLoading && suggestedActions.length > 0 && (
              <Stack align="flex-start" mt="sm" pl="sm">
                <Text size="xs" c="dimmed">Suggested Actions:</Text>
                <Group gap="xs">
                    {suggestedActions.map((action, index) => (
                        <Button
                            key={index}
                            variant="outline"
                            size="xs"
                            onClick={() => handleActionClick(action)}
                        >
                            {action}
                        </Button>
                    ))}
                </Group>
              </Stack>
            )}
          </Stack>
        </ScrollArea>

        {/* Input area - rendering logic remains the same */}
        <Group gap="xs" p="md" wrap="nowrap" style={{ borderTop: `1px solid ${theme.colors.gray[3]}` }} >
          <Textarea
            placeholder="Ask me anything..."
            value={currentInput}
            onChange={(event) => setCurrentInput(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            radius="xl" minRows={1} maxRows={4} autosize
            style={{ flexGrow: 1 }}
          />
          <Button onClick={() => handleSendMessage()} loading={isLoading} disabled={!currentInput.trim()} radius="xl" >
            Send
          </Button>
        </Group>
      </Stack>
    );
}

export default ChatbotInterface;