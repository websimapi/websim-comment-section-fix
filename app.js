import React, { useState, useEffect } from 'react';

// --- Integration with Parent WebSIM System ---

// Try to access parent window's WebSIM functionality
const getParentWebSIM = () => {
    try {
        if (window.parent && window.parent !== window) {
            // Check if parent has WebSIM functionality
            return window.parent;
        }
    } catch (e) {
        console.warn('Cannot access parent window:', e);
    }
    return null;
};

// Extract project ID from URL or parent context
const getProjectId = () => {
    try {
        const parent = getParentWebSIM();
        if (parent && parent.location) {
            const match = parent.location.pathname.match(/\/p\/([^\/]+)/);
            if (match) return match[1];
        }
        // Fallback: try to get from current URL
        const currentMatch = window.location.href.match(/project[_-]?id[=:]([^&\s]+)/i);
        if (currentMatch) return currentMatch[1];
        
        // Try to get from parent URL
        try {
            const parentUrl = window.parent.location.href;
            const parentMatch = parentUrl.match(/\/p\/([^\/\?]+)/);
            if (parentMatch) return parentMatch[1];
        } catch (e) {
            // Cross-origin restriction, ignore
        }
    } catch (e) {
        console.warn('Cannot extract project ID:', e);
    }
    return 'mock_project_id'; // Fallback for demo
};

// ProjectSocket integration for real-time updates
const setupProjectSocket = (projectId, onMessage) => {
    try {
        const parent = getParentWebSIM();
        if (parent && parent.window && parent.window.ProjectSocket) {
            // Use parent's ProjectSocket if available
            const socket = new parent.window.ProjectSocket({ project_id: projectId, onMessage });
            return socket;
        }
    } catch (e) {
        console.warn('ProjectSocket not available:', e);
    }
    return null;
};

// Post comment using parent WebSIM functionality
const postCommentToWebSIM = async (comment, projectId) => {
    try {
        const parent = getParentWebSIM();
        if (parent && parent.window) {
            // Try to access parent's API client
            if (parent.window.I) {
                const apiClient = parent.window.I();
                console.log('Attempting to post comment via WebSIM API:', comment);
                
                const response = await apiClient.ref('POST /projects/:id/comments').fetch({
                    params: { id: projectId },
                    body: { 
                        content: comment.text, 
                        raw_content: comment.text,
                        parent_comment_id: null 
                    }
                });
                
                if (response.ok) {
                    console.log('Successfully posted comment to WebSIM:', response.body);
                    return response.body;
                }
            }
            
            // Try alternative parent API access
            if (parent.fetch) {
                const response = await parent.fetch(`/api/v1/projects/${projectId}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        content: comment.text,
                        raw_content: comment.text,
                        parent_comment_id: null
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    console.log('Successfully posted comment via fetch:', result);
                    return result;
                }
            }
        }
    } catch (e) {
        console.warn('Failed to post to WebSIM:', e);
    }
    
    // Fallback to mock
    return null;
};

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

// Mock function to fetch initial comments
async function fetchComments() {
    const projectId = getProjectId();
    
    // Try to fetch real comments from WebSIM first
    try {
        const parent = getParentWebSIM();
        if (parent && parent.window && parent.window.I) {
            const apiClient = parent.window.I();
            const response = await apiClient.ref('GET /projects/:id/comments').fetch({
                params: { id: projectId },
                query: { sort: 'created_at', limit: 50 }
            });
            
            if (response.ok && response.body && response.body.data) {
                console.log('Fetched real comments from WebSIM:', response.body.data);
                return response.body.data.map(item => ({
                    id: item.comment.id,
                    author: item.comment.created_by?.username || 'User',
                    text: item.comment.content || item.comment.raw_content || 'Comment'
                }));
            }
        }
    } catch (e) {
        console.warn('Failed to fetch real comments, using mock:', e);
    }
    
    // Simulate network delay
    await new Promise(res => setTimeout(res, 300));
    return [...mockInitialComments];
}

// This function now tries WebSIM integration first, then falls back to mock
async function postComment(comment) {
    const projectId = getProjectId();
    
    console.log('Posting comment:', comment, 'to project:', projectId);
    
    // Try WebSIM integration first
    const webSimResult = await postCommentToWebSIM(comment, projectId);
    if (webSimResult) {
        console.log('Posted to WebSIM successfully, waiting for real-time update...');
        return; // WebSIM will handle the real-time update via ProjectSocket
    }
    
    // Fallback to mock behavior
    console.log('WebSIM integration failed, using mock behavior');
    await new Promise(res => setTimeout(res, 500));
    const newComment = { ...comment, id: nextId++ };
    mockInitialComments.push(newComment);

    console.log("Simulating server event: 'comment:created'");
    mockSocket.emit('comment:created', {
        type: 'comment:created',
        data: { comment: newComment }
    });
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
    const [projectSocket, setProjectSocket] = useState(null);

    // Setup WebSIM integration
    useEffect(() => {
        const projectId = getProjectId();
        console.log('Setting up WebSIM integration for project:', projectId);
        
        // Try to setup ProjectSocket for real-time updates
        const socket = setupProjectSocket(projectId, (eventData) => {
            console.log('WebSIM ProjectSocket event:', eventData);
            
            // Handle comment:created events from WebSIM
            if (eventData.type === 'comment:created') {
                const newComment = eventData.data.comment;
                console.log('Received real-time comment:', newComment);
                setComments(currentComments => {
                    if (currentComments.find(c => c.id === newComment.id)) {
                        return currentComments;
                    }
                    return [...currentComments, {
                        id: newComment.id,
                        author: newComment.created_by?.username || 'WebSIM User',
                        text: newComment.content || newComment.raw_content || 'Comment from WebSIM'
                    }];
                });
            }
        });
        
        if (socket) {
            setProjectSocket(socket);
            console.log('ProjectSocket connected successfully');
        } else {
            console.log('ProjectSocket not available, using mock socket');
        }
        
        return () => {
            if (socket && socket.close) {
                socket.close();
            }
        };
    }, []);

    // Fetch initial comments on component mount
    useEffect(() => {
        fetchComments().then(initialComments => {
            setComments(initialComments);
            setIsLoading(false);
        });
    }, []);
    
    // --- Real-Time Update Logic ---
    useEffect(() => {
        const handleNewCommentEvent = (eventData) => {
            console.log("Client received 'comment:created' event:", eventData);
            const newComment = eventData.data.comment;
            setComments(currentComments => {
                if (currentComments.find(c => c.id === newComment.id)) {
                    return currentComments;
                }
                return [...currentComments, newComment];
            });
        };
        
        mockSocket.on('comment:created', handleNewCommentEvent);

        return () => {
            mockSocket.off('comment:created', handleNewCommentEvent);
        };
    }, []);

    // This function is passed to the form. It's now much simpler.
    const handleAddComment = async (comment) => {
        // Just post the comment. The socket listener is responsible for updating the UI.
        await postComment(comment);
    };

    return React.createElement('div', null,
        React.createElement('h1', null, 'Interactive Comment Section'),
        React.createElement('p', { className: 'explanation' }, 
            projectSocket 
                ? 'Connected to WebSIM real-time system! Comments posted here will appear in the actual WebSIM project and will be visible to all users.'
                : 'This demonstration simulates a real-time backend. When you "Send Comment", it tries to connect to the parent WebSIM system first, then falls back to mock behavior.'
        ),
        React.createElement('hr', null),
        React.createElement('h2', null, 'Comments'),
        isLoading
            ? React.createElement('p', { className: 'loading' }, 'Loading comments...')
            : React.createElement(CommentList, { comments: comments }),
        React.createElement('h2', null, 'Add a Comment'),
        React.createElement(CommentForm, { onCommentSubmit: handleAddComment })
    );
}