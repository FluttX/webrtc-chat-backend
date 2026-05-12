import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import {json} from 'body-parser';
import http from 'http';
import {Server} from 'socket.io';
import authRoutes from './routes/authRoutes';
import contactsRoutes from './routes/contactsRoutes';
import conversationRoutes from './routes/conversationsRoutes';
import messagesRoutes from './routes/messagesRoutes';
import { saveMessage } from './controllers/messagesController';
import './cron/cronJob'; 

const openAiApiKey = process.env.OPENAI_API_KEY;

if (!openAiApiKey) {
  throw new Error("Missing OpenAI API key in environment variables.");
}

console.log("OpenAI API Key loaded successfully.");

const app = express();
const server = http.createServer(app);
app.use(json());
const io = new Server(server, {
    cors: {
        origin: '*'
    },
});

app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/contacts', contactsRoutes);


io.on('connection', (socket) => {
    console.log('A user connected',socket.id);

    socket.on('joinConversation',(conversationId) => {
        socket.join(conversationId);
        console.log(`User ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('sendMessage', async (message) => {
        const {conversationId, senderId, content} = message;

        try {
            const savedMessage = await saveMessage(conversationId, senderId, content);
            console.log('sendMessage : ');
            console.log(savedMessage);

            io.to(conversationId).emit('newMessage', savedMessage);
            console.log(`Message sent to conversation ${conversationId}`);

            io.emit('conversationUpdated', {
                conversationId, 
                lastMessage: savedMessage.content,
                lastMessageTime: savedMessage.created_at,
            });
        } catch (error) {
            console.error('Failed to save message', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected', socket.id);
    });
});

const PORT = process.env.PORT || 6000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});