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

// Define the structure for a message
interface Message {
    sender: 'user' | 'bot';
    text: string;
}

// Define the expected API response structure for BOTH endpoints
interface ApiResponse {
    response: string;
    suggested_actions?: string[]; // Optional for action execution response
}

// --- Define the initial bot greeting message ---
const initialBotGreeting = `Hello! I'm your Merchant Assistant.
I can help you analyze sales data, forecast performance (GrabCast functions like generating forecasts or planning food staging), and manage customer retention campaigns (GrabBack functions like drafting messages or identifying inactive customers).

How can I assist you today?`;
// --- End Greeting Message ---

function ChatbotInterface() {
    const theme = useMantineTheme();
    // --- Initialize state with the greeting message ---
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'bot', text: initialBotGreeting }
    ]);
    // --- End Initialization ---
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

        setMessages((prevMessages) => [...prevMessages, userMessage]);
        if (!messageOverride) { setCurrentInput(''); }
        setIsLoading(true);
        setSuggestedActions([]);

        try {
            const response = await fetch('http://localhost:9000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: textToSend }),
            });

            if (!response.ok) {
                throw new Error(`Chat API Error: ${response.statusText} (${response.status})`);
            }

            const data: ApiResponse = await response.json();

            if (data && data.response) {
                const botMessage: Message = { sender: 'bot', text: data.response };
                setMessages((prevMessages) => [...prevMessages, botMessage]);
                setSuggestedActions(data.suggested_actions && Array.isArray(data.suggested_actions) ? data.suggested_actions : []);
            } else {
                 console.error("Invalid chat response format:", data);
                 const errorMessage: Message = { sender: 'bot', text: "Sorry, I received an unexpected chat response." };
                 setMessages((prevMessages) => [...prevMessages, errorMessage]);
                 setSuggestedActions([]);
            }
        } catch (error) {
            console.error('Failed to send chat message:', error);
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I couldn't connect. Please try again." };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
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
    const handleActionClick = async (action: string) => {
        console.log("Action clicked:", action);

        if (action === "Identify Inactive Customers") {
            navigate("/customers?filter=inactive");
            setSuggestedActions([]);
            return;
        }

        setIsLoading(true);
        setSuggestedActions([]);

        try {
            const response = await fetch('http://localhost:9000/api/execute_action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action_name: action }),
            });

            if (!response.ok) {
                throw new Error(`Action API Error: ${response.statusText} (${response.status})`);
            }

            const data: ApiResponse = await response.json();

            if (data && data.response) {
                const botMessage: Message = { sender: 'bot', text: data.response };
                setMessages((prevMessages) => [...prevMessages, botMessage]);
            } else {
                 console.error("Invalid action response format:", data);
                 const errorMessage: Message = { sender: 'bot', text: "Sorry, the action completed but I couldn't get the result." };
                 setMessages((prevMessages) => [...prevMessages, errorMessage]);
            }
        } catch (error) {
            console.error('Failed to execute action:', error);
            const errorMessage: Message = { sender: 'bot', text: `Sorry, I couldn't perform the action: ${action}. Please try again.` };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };


    // JSX return remains the same, ensuring Text component handles newlines
    return (
      <Stack justify="space-between" h="100%">
        {/* Scrollable message area */}
        <ScrollArea style={{ flexGrow: 1, overflow: "hidden" }} h="100%" viewportRef={viewport} type="auto">
          <Stack p="md" gap="lg">
            {messages.map((message, index) => (
              <Paper
                key={`${message.sender}-${index}-${message.text.substring(0, 10)}`}
                shadow="xs" radius="lg" p="sm" withBorder
                style={{
                  alignSelf: message.sender === "user" ? "flex-end" : "flex-start",
                  backgroundColor: message.sender === "user" ? theme.colors.blue[0] : theme.colors.gray[1],
                  maxWidth: "80%",
                }}
              >
                 {/* Ensure whiteSpace handles newlines in greeting */}
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{message.text}</Text>
              </Paper>
            ))}
            {isLoading && ( <Group justify="center" mt="sm"> <Loader size="sm" type="dots" /> </Group> )}

            {/* Conditionally render suggested action buttons */}
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

        {/* Input area */}
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