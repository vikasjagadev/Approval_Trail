import React, { useState } from 'react';
import { format } from 'date-fns';
import { Send, MessageSquare } from 'lucide-react';
import { Comment } from '../api/types';

interface CommentBoxProps {
  comments: Comment[];
  onAddComment: (body: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const CommentBox: React.FC<CommentBoxProps> = ({
  comments,
  onAddComment,
  isSubmitting = false,
}) => {
  const [body, setBody] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError('Comment cannot be empty');
      return;
    }
    setError('');
    await onAddComment(body.trim());
    setBody('');
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4 border-b pb-3">
        <MessageSquare className="h-5 w-5 text-gray-500" />
        <h3 className="text-base font-semibold text-gray-900">Comments & Discussion</h3>
        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          {comments.length}
        </span>
      </div>

      <div className="space-y-4 mb-6 max-h-96 overflow-y-auto pr-1">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex space-x-3 text-sm">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase">
                  {comment.author?.name ? comment.author.name.charAt(0) : 'U'}
                </div>
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-gray-900">
                    {comment.author?.name || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(new Date(comment.createdAt), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-gray-700 whitespace-pre-wrap">{comment.body}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4">
        <div>
          <textarea
            rows={3}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (error) setError('');
            }}
            placeholder="Write a comment or reply..."
            className="w-full text-sm rounded-md border border-gray-300 p-2.5 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !body.trim()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>
    </div>
  );
};

