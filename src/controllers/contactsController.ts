import {Request, Response} from 'express';
import pool from '../models/db';

export const fetchContacts = async (req: Request, res: Response) => {
    try{
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized: Authentication token is missing.' });
            return;
        }

        const query = `
        SELECT 
            u.id AS contact_id,
            u.username, 
            u.profile_image,
            u.email 
        FROM contacts c
        INNER JOIN users u ON c.contact_id = u.id
        WHERE c.user_id = $1
        ORDER BY u.username ASC
        `;
        
        const { rows } = await pool.query(query, [userId]); 

        res.status(200).json(rows);
        
    } catch(error) {
        console.error('Error fetching contacts:', error);
        res.status(500).json({ message: 'An error occurred while fetching contacts.' });
    }
}


export const fetchRecentContacts = async (req: Request, res: Response) => {
    try{
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized: Authentication token is missing.' });
            return;
        }
        
        const query = `
        SELECT 
            u.id AS contact_id,
            u.username,
            u.profile_image,
            u.email
        FROM contacts c
        JOIN users u ON u.id = c.contact_id
        WHERE c.user_id = $1
        ORDER BY c.created_at DESC
        LIMIT 8
        `;
        
        const { rows } = await pool.query(query, [userId]);

        res.status(200).json(rows);
        
    } catch(error) {
        console.error('Error fetching recent contacts:', error);
        res.status(500).json({ message: 'An error occurred while fetching recent contacts.' });
    }    

}


export const addContact = async (req: Request, res: Response) => {
    try{
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized: Authentication token is missing.' });
            return;
        }
        
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ message: 'Bad Request: Email is required.' });
            return;
        }

        const contactQuery = `SELECT id FROM users WHERE email = $1`;
        const contactResult = await pool.query(contactQuery, [email]);

        if (contactResult.rowCount === 0) {
            res.status(404).json({ message: 'Not Found: Contact not found.' });
            return;
        }

        const contactId = contactResult.rows[0].id;

        const insertQuery  = `
            INSERT INTO contacts (user_id, contact_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, contact_id) DO NOTHING;
        `;

        const result = await pool.query(insertQuery , [userId, contactId]);

        if (result.rowCount === 0) {
            res.status(200).json({ message: 'Contact already exists.' });
            return;
        }

        res.status(201).json({ message: 'Contact added successfully.' });
        
    } catch(error) {
        console.error('Error adding contact:', error);
        res.status(500).json({ message: 'An error occurred while adding the contact.' });
    }
}