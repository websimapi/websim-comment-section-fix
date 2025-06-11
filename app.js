import React, { useState, useEffect } from 'react';

// --- Mock API, "Overridden" Functions, and a Mock WebSocket ---

// A simple event emitter to simulate a real-time connection (like a WebSocket)
// This helps demonstrate the pattern you observed with 'ProjectSocket'.
const mockSocket = {
    listeners: {},
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    },
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
};

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
// It now simulates sending a comment and then receiving a real-time event.
async function postComment(comment) {
    // Simulate network delay and backend processing
    await new Promise(res => setTimeout(res, 500));
    const newComment = { ...comment, id: nextId++ };
    mockInitialComments.push(newComment); // Add to our mock "database"

    // In a real-time application, the server would push an event back to all
    // connected clients. We simulate that here, mimicking the 'ProjectSocket'
    // event the user described.
    console.log("Simulating server event: 'comment:created'");
    mockSocket.emit('comment:created', {
        type: 'comment:created',
        data: { comment: newComment }
    });
    // The function no longer needs to return the comment. The UI update is
    // now handled by the socket listener in the App component.
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
        // This now just sends the comment. The UI update is handled by the event listener.
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
    
    // --- Real-Time Update Logic ---
    // This effect sets up a listener for our mock socket.
    // This mirrors how a real application would listen for WebSocket events
    // like the 'comment:created' one you described.
    useEffect(() => {
        const handleNewCommentEvent = (eventData) => {
            console.log("Client received 'comment:created' event:", eventData);
            const newComment = eventData.data.comment;
            // The state update here is what makes the new comment appear in the list.
            setComments(currentComments => {
                // Avoid adding duplicates if a comment somehow already exists
                if (currentComments.find(c => c.id === newComment.id)) {
                    return currentComments;
                }
                return [...currentComments, newComment];
            });
        };
        
        // Listen for new comments
        mockSocket.on('comment:created', handleNewCommentEvent);

        // Clean up the listener when the component unmounts to prevent memory leaks
        return () => {
            mockSocket.off('comment:created', handleNewCommentEvent);
        };
    }, []); // The empty dependency array ensures this effect runs only once.

    // This function is passed to the form. It's now much simpler.
    const handleAddComment = async (comment) => {
        // Just post the comment. The socket listener is responsible for updating the UI.
        await postComment(comment);
    };

    return React.createElement('div', null,
        React.createElement('h1', null, 'Interactive Comment Section'),
        React.createElement('p', { className: 'explanation' }, 'This demonstration now simulates a real-time backend. When you "Send Comment", it mimics sending data to a server, which then broadcasts a "comment:created" event (like the "ProjectSocket" event you mentioned) to all users. The app listens for this event and updates the comment list, ensuring everyone sees the new comment instantly.'),
        React.createElement('hr', null),
        React.createElement('h2', null, 'Comments'),
        isLoading
            ? React.createElement('p', { className: 'loading' }, 'Loading comments...')
            : React.createElement(CommentList, { comments: comments }),
        React.createElement('h2', null, 'Add a Comment'),
        React.createElement(CommentForm, { onCommentSubmit: handleAddComment })
    );
}