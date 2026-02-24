import {Request, Response} from 'express';
import bcrypt from 'bcryptjs';
import pool from '../models/db';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET ||  'convo_sphere_secret_key';
const randomImages = [
    'https://randomuser.me/api/portraits/men/1.jpg',
    'https://randomuser.me/api/portraits/men/2.jpg',
    'https://randomuser.me/api/portraits/women/3.jpg',
    'https://randomuser.me/api/portraits/men/4.jpg',
    'https://randomuser.me/api/portraits/women/5.jpg',
    ];

const validateInput = (username: string, email: string, password: string) => {
    const errors: { field: string; message: string }[] = [];

    if (!username || username.trim().length < 3) {
        errors.push({ field: 'username', message: 'Username must be at least 3 characters long.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errors.push({ field: 'email', message: 'Invalid email address.' });
    }

    if (!password || password.length < 6) {
        errors.push({ field: 'password', message: 'Password must be at least 6 characters long.' });
    }

    return errors;
};

export const register = async (req: Request, res: Response): Promise<void> => {
    const {username, email, password} = req.body;

    console.log('register called');

    const errors = validateInput(username, email, password);
    if (errors.length > 0) {
        res.status(400).json({ message: 'Validation failed', errors, status: false });
        return;
    }

    try{
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        const randomImage = randomImages[Math.floor(Math.random() * randomImages.length)];
        const result = await pool.query(
            'INSERT INTO users (username, email, password, profile_image) VALUES ($1, $2, $3, $4) RETURNING *',
            [username, email, hashedPassword, randomImage]
        );

        const user = result.rows[0];

        res.status(201).json({
            message: 'User registration successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                token: '',
            },
            status: true,
        });
    } catch (err) {
       
        let errorMessage = 'An unexpected error occurred.';
        let statusCode = 500;
        const fieldErrors: { field: string; message: string }[] = [];

        if (err instanceof Error) {
            if ('code' in err) {
                const errorWithCode = err as { code: string; detail?: string; constraint?: string };

                if (errorWithCode.code === '23505') {
                    if (errorWithCode.constraint === 'users_username_key') {
                        fieldErrors.push({ field: 'username', message: 'Username already exists.' });
                        errorMessage = 'One or more fields have invalid input.';
                        statusCode = 400;
                    } else if (errorWithCode.constraint === 'users_email_key') {
                        fieldErrors.push({ field: 'email', message: 'Email already exists.' });
                        errorMessage = 'One or more fields have invalid input.';
                        statusCode = 400;
                    }
                }
            }
        }

        res.status(statusCode).json({
            message: errorMessage,
            errors: fieldErrors.length > 0 ? fieldErrors : undefined,
            status: false,
        });
    }
}

export const login = async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;

    console.log('login called');

    if (!email || !password) {
        res.status(400).json({
            message: 'Missing email or password.',
            errors: [
                !email ? { field: 'email', message: 'Email is required.' } : null,
                !password ? { field: 'password', message: 'Password is required.' } : null,
            ].filter(Boolean),
            status: false,
        });
        return;
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            res.status(401).json({
                message: 'Invalid email or password.',
                errors: [{ field: 'email', message: 'Email not found or incorrect.' }],
                status: false,
            });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({
                message: 'Invalid email or password.',
                errors: [{ field: 'password', message: 'Password is incorrect.' }],
                status: false,
            });
            return;
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            JWT_SECRET,
            { expiresIn: '10h' }
        );

        res.status(200).json({
            message: 'Login successful.',
            user: { id: user.id, username: user.username, email: user.email, profile_image: user.profile_image, token: token },
            status: true,
        });
    } catch (err) {
        res.status(500).json({
            message: 'An error occurred while processing your login request.',
            status: false,
        });
    }
};