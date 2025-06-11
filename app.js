import React, { useState, useEffect } from 'react';

// --- Mock API & "Overridden" Functions ---
// This simulates a backend. In a real app, these would be network requests.
// We're creating a mock to demonstrate the fix for the comment submission.
const mockInitialComments = [
    { id: 1, author: 'Alice', text: 'This is the first comment.' },
    { id: 2, author: 'Bob', text: 'Here is another one.' },
];

let nextId = 3;

// This function "overrides" any non-working logic to properly fetch comments.
async function fetchComments() {
    // Simulate network delay
    await new Promise(res => setTimeout(res, 500));
    return [...mockInitialComments]; // Return a copy to prevent mutation issues
}

// This function "overrides" the broken send command.
async function postComment(comment) {
    // Simulate network delay and backend processing
    await new Promise(res => setTimeout(res, 500));
    const newComment = { ...comment, id: nextId++ };
    mockInitialComments.push(newComment); // Add to our mock "database"
    return newComment;
}

// --- React Components (without JSX) ---

function Comment({ author, text }) {
    return React.createElement(
        'div',
        { className: 'comment' },
        React.createElement(
            'p',
            null,
            React.createElement('strong', null, author),
            ': ',
            text
        )
    );
}

function CommentList({ comments }) {
    if (comments.length === 0) {
        return React.createElement('div', { className: 'explanation' }, 'No comments yet. Be the first to post!');
    }
    return React.createElement(
        'div',
        { className: 'comment-list' },
        comments.map(comment =>
            React.createElement(Comment, { key: comment.id, author: comment.author, text: comment.text })
        )
    );
}

function CommentForm({ onCommentSubmit }) {
    const [author, setAuthor] = useState('User');
    const [text, setText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!author.trim() || !text.trim() || isSubmitting) return;
        
        setIsSubmitting(true);
        await onCommentSubmit({ author, text });
        setText('');
        setIsSubmitting(false);
    };

    return React.createElement('form', { className: 'comment-form', onSubmit: handleSubmit },
        React.createElement('input', {
            type: 'text',
            placeholder: 'Your name',
            value: author,
            onChange: (e) => setAuthor(e.target.value),
            'aria-label': 'Your name',
            disabled: isSubmitting
        }),
        React.createElement('textarea', {
            placeholder: 'Write a comment...',
            value: text,
            onChange: (e) => setText(e.target.value),
            rows: '3',
            'aria-label': 'Comment text',
            disabled: isSubmitting
        }),
        React.createElement('button', { type: 'submit', disabled: isSubmitting },
            isSubmitting ? 'Sending...' : 'Send Comment'
        )
    );
}

export default function App() {
    const [comments, setComments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch initial comments on component mount
    useEffect(() => {
        fetchComments().then(initialComments => {
            setComments(initialComments);
            setIsLoading(false);
        });
    }, []);

    // This function handles the submission and updates the UI.
    // This is the core of the fix: ensuring the React state is updated
    // after the "send" action is complete, which triggers a re-render.
    const handleAddComment = async (comment) => {
        const newComment = await postComment(comment);
        // The state update here is what makes the new comment appear in the list.
        // The original code was likely missing this crucial step.
        setComments(currentComments => [...currentComments, newComment]);
    };

    return React.createElement('div', null,
        React.createElement('h1', null, 'Interactive Comment Section'),
        React.createElement('p', { className: 'explanation' }, 'This is a working demonstration of a comment section. The key fix is that after you "Send Comment", the list updates immediately. This is achieved by properly updating the application\'s state after the comment is submitted.'),
        React.createElement('hr', null),
        React.createElement('h2', null, 'Comments'),
        isLoading
            ? React.createElement('p', { className: 'loading' }, 'Loading comments...')
            : React.createElement(CommentList, { comments: comments }),
        React.createElement('h2', null, 'Add a Comment'),
        React.createElement(CommentForm, { onCommentSubmit: handleAddComment })
    );
}