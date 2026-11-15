import React, { useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  requireComment?: boolean;
  commentLabel?: string;
  commentPlaceholder?: string;
  onConfirm: (comment?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  confirmVariant = 'primary',
  requireComment = false,
  commentLabel = 'Comment / Reason',
  commentPlaceholder = 'Enter details here (at least 3 characters)...',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireComment && comment.trim().length < 3) {
      setCommentError('Comment is required and must be at least 3 characters.');
      return;
    }
    setCommentError('');
    onConfirm(comment.trim() ? comment.trim() : undefined);
  };

  const getVariantBtn = () => {
    switch (confirmVariant) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500';
      case 'primary':
      default:
        return 'bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-gray-500 bg-opacity-75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl transform transition-all">
        <h3 id="dialog-title" className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-gray-600 mb-4">{message}</p>

        {(requireComment || commentPlaceholder) && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {commentLabel} {requireComment && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="w-full text-sm border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              rows={3}
              value={comment}
              placeholder={commentPlaceholder}
              onChange={(e) => {
                setComment(e.target.value);
                if (commentError) setCommentError('');
              }}
            />
            {commentError && <p className="text-xs text-red-600 mt-1">{commentError}</p>}
          </div>
        )}

        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-2">
          <button
            type="button"
            disabled={isLoading}
            onClick={handleConfirm}
            className={`w-full sm:w-auto inline-flex justify-center rounded-md px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${getVariantBtn()}`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => {
              setComment('');
              setCommentError('');
              onCancel();
            }}
            className="mt-3 sm:mt-0 w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

