import React, { useState, useEffect, useRef } from 'react';
import {
    Stack,
    // TextInput, // Or Textarea for multiline
    Textarea,
    Button,
    ScrollArea,
    Paper,
    Text,
    Loader,
    Group,
    // ActionIcon, // Alternative to Button for send icon
    useMantineTheme,
} from '@mantine/core';
// import { IconSend } from '@tabler/icons-react';

// Define the structure for a message
interface Message {
    sender: 'user' | 'bot';
    text: string;
}

function ChatbotInterface() {
    const theme = useMantineTheme();
    const [messages, setMessages] = useState<Message[]>([]); // Array to hold chat messages
    const [currentInput, setCurrentInput] = useState(''); // User's current input
    const [isLoading, setIsLoading] = useState(false); // Loading state for bot response

    const viewport = useRef<HTMLDivElement>(null); // Ref for scrolling

    // Function to scroll to the bottom of the chat
    const scrollToBottom = () => {
        // Timeout ensures this runs after the DOM update
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

    // Function to handle sending a message
    const handleSendMessage = async () => {
        const trimmedInput = currentInput.trim();
        if (!trimmedInput || isLoading) return; // Don't send empty messages or while loading

        const userMessage: Message = { sender: 'user', text: trimmedInput };

        // Update UI immediately with user message
        setMessages((prevMessages) => [...prevMessages, userMessage]);
        setCurrentInput(''); // Clear input field
        setIsLoading(true); // Show loading indicator

        // --- API Call ---
        try {
            // Replace with your actual backend API endpoint
            const response = await fetch('http://localhost:9000/api/chat', { // Make sure this matches your backend route
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                // Send message and potentially history for context
                body: JSON.stringify({
                    message: trimmedInput,
                    // Optional: send previous messages for context-aware bots
                    // history: messages,
                }),
            });

            if (!response.ok) {
                // Throw an error if response status is not OK
                throw new Error(`API Error: ${response.statusText} (Status: ${response.status})`);
            }

            const data = await response.json();

            // Ensure the backend sends response in expected format, e.g., { response: "..." }
            if (data && data.response) {
                const botMessage: Message = { sender: 'bot', text: data.response };
                setMessages((prevMessages) => [...prevMessages, botMessage]);
            } else {
                 console.error("Invalid response format from backend:", data);
                 const errorMessage: Message = { sender: 'bot', text: "Sorry, I received an unexpected response." };
                 setMessages((prevMessages) => [...prevMessages, errorMessage]);
            }

        } catch (error) {
            console.error('Failed to send message:', error);
            // Display an error message in the chat
            const errorMessage: Message = { sender: 'bot', text: "Sorry, I couldn't connect. Please try again." };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false); // Hide loading indicator
            // Refocus input after sending/receiving might be needed depending on UX preference
            // inputRef.current?.focus(); // requires adding useRef to the input
        }
        // --- End API Call ---
    };

     // Handle Enter key press in Textarea (Shift+Enter for newline)
     const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault(); // Prevent default newline insertion
            handleSendMessage();
        }
    };


    return (
      // Use Stack for overall vertical layout within the Aside
      <Stack justify="space-between" h="100%">
        {" "}
        {/* Make Stack take full height */}
        {/* Scrollable message area */}
        {/* Using 'auto' height on ScrollArea and flex-grow on its container */}
        <ScrollArea style={{ flexGrow: 1, overflow: "hidden" }} h="100%" viewportRef={viewport} type="auto">
          <Stack p="md" gap="lg">
            {" "}
            {/* Add padding and gap between messages */}
            {messages.map((message, index) => (
              <Paper
                key={index}
                shadow="xs"
                radius="lg"
                p="sm"
                withBorder
                style={{
                  // Align messages left/right based on sender
                  alignSelf:
                    message.sender === "user" ? "flex-end" : "flex-start",
                  // Different background colors for user/bot
                  backgroundColor:
                    message.sender === "user"
                      ? theme.colors.blue[0] // Light blue for user
                      : theme.colors.gray[1], // Light grey for bot
                  maxWidth: "80%", // Prevent messages from being too wide
                }}
              >
                <Text size="sm">{message.text}</Text>
              </Paper>
            ))}
            {/* Loading indicator */}
            {isLoading && (
              <Group justify="center" mt="sm">
                <Loader size="sm" type="dots" />
              </Group>
            )}
          </Stack>
        </ScrollArea>
        {/* Input area at the bottom */}
        <Group
          gap="xs"
          p="md"
          wrap="nowrap" // Prevent wrapping
          style={{ borderTop: `1px solid ${theme.colors.gray[3]}` }}
        >
          <Textarea
            placeholder="Ask me anything..."
            value={currentInput}
            onChange={(event) => setCurrentInput(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            radius="xl" // Rounded corners
            minRows={1} // Start small
            maxRows={4} // Limit growth
            autosize // Enable auto-resizing
            style={{ flexGrow: 1 }} // Make input take available space
          />

          <Button
            onClick={handleSendMessage}
            loading={isLoading}
            disabled={!currentInput.trim()}
            radius="xl"
          >
            Send
          </Button>
          {/* Or use an Icon */}
          {/* <ActionIcon
                  onClick={handleSendMessage}
                  loading={isLoading} // Show loader on the icon button
                  disabled={!currentInput.trim()}
                  size="lg"
                  variant="filled" // Or "light", "outline"
                  radius="xl"
                  color="blue"
              >
                  <IconSend size="1.1rem" stroke={1.5} />
              </ActionIcon> */}
        </Group>
      </Stack>
    );
}

export default ChatbotInterface;