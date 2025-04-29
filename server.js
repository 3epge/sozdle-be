const express = require('express');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();
const app = express();
const port = 4200;

app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://sozdle.3epge.com');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    next();
});

const APPROVED_WORDS_FILE = path.join(__dirname, 'approvedWords.json');

const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key';

let approvedWords = [];
let newWords = [];

async function loadApprovedWords() {
    try {
        const data = await fs.readFile(APPROVED_WORDS_FILE, 'utf8');
        approvedWords = JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            approvedWords = [];
        } else if (err.code === 'EACCES') {
            console.error('Permission denied reading approvedWords.json');
            throw new Error('Server lacks permission to read approved words file');
        } else {
            console.error('Error loading approved words:', err);
        }
    }
}

async function saveApprovedWords() {
    try {
        await fs.writeFile(APPROVED_WORDS_FILE, JSON.stringify(approvedWords, null, 2));
    } catch (err) {
        console.error('Error saving approved words:', err);
    }
}

function isValidWord(word) {
    return typeof word === 'string' && word.length === 5;
}

function checkSecretKey(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${SECRET_KEY}`) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing secret key' });
    }
    next();
}

loadApprovedWords().then(() => {
    console.log('Approved words loaded');
});

app.get('/api/approved-words', (req, res) => {
    res.json(approvedWords);
});

app.post('/api/new-word', (req, res) => {
    const { word } = req.body;
    if (!word) {
        return res.status(400).json({ error: 'Word is required' });
    }
    if (!isValidWord(word)) {
        return res.status(400).json({ error: 'Word must be exactly 5 letters' });
    }
    const lowerWord = word.toLowerCase();
    if (approvedWords.includes(lowerWord)) {
        return res.status(400).json({ error: 'Word already exists' });
    }
    if (!newWords.includes(lowerWord)) newWords.push(lowerWord);
    res.status(201).json({ message: 'Word added', word: lowerWord });
});

app.get('/api/new-words', (req, res) => {
    res.json(newWords);
});

app.post('/api/approve-words', checkSecretKey, (req, res) => {
    const { words } = req.body;
    if (!words || !Array.isArray(words)) {
        return res.status(400).json({ error: 'Words must be a non-empty array' });
    }
    const validWords = [...new Set(
        words.filter(word => isValidWord(word) && !approvedWords.includes(word))
    )];
    if (validWords.length === 0) {
        return res.status(400).json({ error: 'No valid new words to approve' });
    }
    approvedWords.push(...validWords);
    newWords = newWords.filter(word => !validWords.includes(word));
    saveApprovedWords();
    res.status(201).json({ message: 'Words approved', count: validWords.length, words: validWords });
});

app.delete('/api/reset', checkSecretKey, (req, res) => {
    try {
        newWords = [];
        res.status(200).json({ message: 'New words cleared' });
    } catch (error) {
        console.error('Error clearing new words:', error);
        res.status(500).json({ error: 'Failed to clear new words' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});