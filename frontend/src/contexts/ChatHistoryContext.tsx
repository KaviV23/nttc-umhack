import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define the structure for a message (same as in ChatbotInterface)
export interface Message {
    sender: 'user' | 'bot';
    text: string;
}

// --- Define the initial bot greeting message ---
const initialBotGreeting = `Hello! I'm MEX, your personal virtual assistant.
I can help you analyze sales data, forecast performance and manage customer retention campaigns.

How can I assist you today?`;
// --- End Greeting Message ---

// Define the shape of the context data
interface ChatHistoryContextType {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    addMessage: (message: Message) => void; // Helper function
}

// Create the context with a default value (can be undefined initially)
const ChatHistoryContext = createContext<ChatHistoryContextType | undefined>(undefined);

// Create a provider component
interface ChatHistoryProviderProps {
    children: ReactNode;
}

export const ChatHistoryProvider: React.FC<ChatHistoryProviderProps> = ({ children }) => {
    // --- Initialize state with the greeting message ---
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'bot', text: initialBotGreeting }
    ]);
    // --- End Initialization ---

    // Helper function to add a message (ensures atomicity if needed later)
    const addMessage = (message: Message) => {
        setMessages(prevMessages => [...prevMessages, message]);
    };

    // Value provided to consuming components
    const value = {
        messages,
        setMessages, // Provide direct setter if needed elsewhere
        addMessage
    };

    return (
        <ChatHistoryContext.Provider value={value}>
            {children}
        </ChatHistoryContext.Provider>
    );
};

// Custom hook to use the chat history context
export const useChatHistory = (): ChatHistoryContextType => {
    const context = useContext(ChatHistoryContext);
    if (context === undefined) {
        throw new Error('useChatHistory must be used within a ChatHistoryProvider');
    }
    return context;
};