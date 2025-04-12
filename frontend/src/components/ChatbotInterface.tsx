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
    Divider, // Import Divider
} from '@mantine/core';

// Define the structure for a message
interface Message {
    sender: 'user' | 'bot';
    text: string;
    // Optional: Add actions specifically to bot messages if needed,
    // but managing separately in state might be cleaner.
    // suggested_actions?: string[];
}

// Define the expected API response structure
interface ApiResponse {
    response: string;
    suggested_actions?: string[]; // Make it optional
}

function ChatbotInterface() {
    const theme = useMantineTheme();
    const [messages, setMessages] = useState<Message[]>([]);
    const [currentInput, setCurrentInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [suggestedActions, setSuggestedActions] = useState<string[]>([]); // <-- New state for actions

    const viewport = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        setTimeout(() => {
            viewport.current?.scrollTo({
                top: viewport.current.scrollHeight,
                behavior: 'smooth',
            });
        }, 0);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        const trimmedInput = currentInput.trim();
        if (!trimmedInput || isLoading) return;

        const userMessage: Message = { sender: 'user', text: trimmedInput };

        setMessages((prevMessages) => [...prevMessages, userMessage]);
        setCurrentInput('');
        setIsLoading(true);
        setSuggestedActions([]); // <-- Clear previous actions when user sends message

        try {
            const response = await fetch('http://localhost:9000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: trimmedInput }),
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText} (Status: ${response.status})`);
            }

            // Explicitly type the parsed data
            const data: ApiResponse = await response.json();

            // Handle bot response message
            if (data && data.response) {
                const botMessage: Message = { sender: 'bot', text: data.response };
                setMessages((prevMessages) => [...prevMessages, botMessage]);

                // Handle suggested actions
                if (data.suggested_actions && Array.isArray(data.suggested_actions)) {
                    setSuggestedActions(data.suggested_actions); // <-- Store received actions
                } else {
                    setSuggestedActions([]); // Clear actions if none received or invalid format
                }

            } else {
                 console.error("Invalid response format from backend:", data);
                 const errorMessage: Message = { sender: 'bot', text: "Sorry, I received an unexpected response." };
                 setMessages((prevMessages) => [...prevMessages, errorMessage]);
                 setSuggestedActions([]); // Clear actions on error
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I couldn't connect. Please try again." };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
            setSuggestedActions([]); // Clear actions on error
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSendMessage();
        }
    };

    // Function to handle clicking a suggested action (placeholder)
    const handleActionClick = (action: string) => {
        console.log("Action clicked:", action);
        // You would typically trigger another API call or UI change here
        // Maybe pre-fill the input or send a specific command back?
        // For now, let's just add it as a user message to simulate choosing it
        const actionMessage: Message = { sender: 'user', text: `Okay, let's do this: ${action}` };
        // setMessages((prevMessages) => [...prevMessages, actionMessage]);
        setCurrentInput(`Okay, let's do this: ${action}`);
        setSuggestedActions([]); // Clear actions after one is chosen

        // Optionally trigger sending this new message automatically
        // handleSendMessage(); // Be careful with recursion/loops here
    };


    return (
      <Stack justify="space-between" h="100%">
        {/* Scrollable message area */}
        <ScrollArea style={{ flexGrow: 1, overflow: "hidden" }} h="100%" viewportRef={viewport} type="auto">
          <Stack p="md" gap="lg">
            {messages.map((message, index) => (
              <Paper
                key={index} /* Use a more unique key if possible */
                shadow="xs" radius="lg" p="sm" withBorder
                style={{
                  alignSelf: message.sender === "user" ? "flex-end" : "flex-start",
                  backgroundColor: message.sender === "user" ? theme.colors.blue[0] : theme.colors.gray[1],
                  maxWidth: "80%",
                }}
              >
                <Text size="sm">{message.text}</Text>
              </Paper>
            ))}
            {isLoading && ( <Group justify="center" mt="sm"> <Loader size="sm" type="dots" /> </Group> )}

            {/* Conditionally render suggested action buttons */}
            {!isLoading && suggestedActions.length > 0 && (
              <Stack align="flex-start" mt="sm" pl="sm"> {/* Align buttons left like bot messages */}
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
        {/* Optional Divider */}
        {/* <Divider my="xs" /> */}
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
          <Button onClick={handleSendMessage} loading={isLoading} disabled={!currentInput.trim()} radius="xl" >
            Send
          </Button>
        </Group>
      </Stack>
    );
}

export default ChatbotInterface;