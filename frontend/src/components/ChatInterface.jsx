import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Cpu, Download, PlusCircle, Menu } from 'lucide-react';
import { exportChatToPdf } from '../services/PdfExportService';
import { chatAPI } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChatContext } from '../context/ChatContext';
import { useDialog } from '../context/DialogContext';
import { sanitizeStreamingText } from '../services/streamSanitizer';


// ── Casual message detection ──────────────────────────────────────────────────
const isCasualMessage = (text) => {
  const casual = [
    /^hi+\s*[!.]*$/i, /^hello\s*[!.]*$/i, /^hey\s*[!.]*$/i,
    /^how are you/i, /^what'?s up/i, /^good (morning|afternoon|evening)/i,
    /^thanks?\b/i, /^thank you/i, /^ok\b/i, /^okay\b/i, /^cool\b/i,
    /^great\b/i, /^nice\b/i, /^bye\b/i, /^goodbye\b/i, /^see you/i,
    /^lol\b/i, /^haha/i, /^wow\b/i, /^yes\b/i, /^no\b/i, /^sure\b/i,
    /^help\s*[!.]*$/i, /^who are you/i, /^what can you do/i,
  ];
  return casual.some((r) => r.test(text.trim()));
};

const casualReplies = [
  "Hey! 👋 Feel free to ask me anything about your documents.",
  "Hi there! Ask me anything.",
  "Hello! I'm here to help. What would you like to know?",
  "Hey! What's on your mind?",
  "Thanks! Let me know if you have any questions.",
  "You're welcome! Anything else I can help with?",
  "Sure thing! What would you like to know?",
  "I'm doing great, thanks! Ready to help.",
  "Good to hear from you! Ask away.",
  "👋 Hi! Go ahead and ask me anything.",
];

// DEFAULT_SUGGESTED_QUESTIONS removed entirely

const getCasualReply = () => casualReplies[Math.floor(Math.random() * casualReplies.length)];

// ── Provider icons ────────────────────────────────────────────────────────────
const getProviderIcon = (provider) => {
  switch (provider) {
    case 'gemini': return <Sparkles size={12} className="text-blue-400" />;
    default: return null;
  }
};

const getProviderName = (provider) => {
  switch (provider) {
    case 'gemini': return 'Gemini';
    default: return provider || '';
  }
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
const formatText = (text) => {
  if (!text) return null;
  const sanitized = sanitizeStreamingText(text);
  return (
    <div className="prose dark:prose-invert max-w-none text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
          a: ({ node, ...props }) => <a className="text-primary hover:underline" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
          code: ({ node, className, children, ...props }) => {
            const isInline = !className?.includes('language-');
            return isInline
              ? <code className="bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
              : <code className={className} {...props}>{children}</code>;
          },
        }}
      >
        {sanitized || ''}
      </ReactMarkdown>
    </div>
  );
};

// ── Message components ────────────────────────────────────────────────────────
const UserMessage = ({ content }) => (
  <div className="flex gap-3 flex-row-reverse">
    <div className="shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-sm mt-5">
      <User size={15} />
    </div>
    <div className="flex flex-col gap-1 items-end max-w-[85%] sm:max-w-[72%]">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">You</span>
      <div className="bg-primary text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-sm">
        <p className="text-sm whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  </div>
);

const AssistantMessage = ({ 
  content, 
  provider, 
  error, 
  isStreaming, 
  metadata = {}, 
  afterSuggestions = [], 
  onFollowUp 
}) => {
  const {
    answer_type = 'not_found',
    confidence = 0,
    confidence_low = false,
    suggestions = [],
  } = metadata || {};

  const confidenceVal = typeof confidence === 'number' ? confidence : 0;

  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (conf >= 0.5) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  // Merge backend suggestions + newly generated suggestions
  const allSuggestions = [...new Set([...suggestions, ...afterSuggestions])].slice(0, 4);

  return (
    <div className="flex gap-3 flex-row">
      <div className="shrink-0 w-8 h-8 rounded-full bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 text-primary flex items-center justify-center shadow-sm mt-5">
        <Bot size={15} />
      </div>
      <div className="flex flex-col gap-1 items-start max-w-[85%] sm:max-w-[80%]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1">NEXORA</span>

        {isStreaming && !content ? (
          <div className="bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5 shadow-sm">
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <div className={`px-4 py-3 w-full ${
            error
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-2xl rounded-tl-none shadow-sm'
              : 'bg-white/92 border border-[#e91e8c]/10 shadow-[0_2px_8px_rgba(233,30,140,0.06)] rounded-[18px_18px_18px_4px] text-gray-800 dark:bg-white/5 dark:border-white/10 dark:text-gray-200'
          }`}>
            <div>{formatText(content)}</div>

            {!isStreaming && Object.keys(metadata).length > 0 && confidenceVal > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-white/10">
                <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getConfidenceColor(confidenceVal)}`}>
                  Confidence: {Math.round(confidenceVal * 100)}%
                </div>
                {answer_type && answer_type !== 'not_found' && (
                  <div className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300 capitalize">
                    {answer_type.replace('_', ' ')}
                  </div>
                )}
              </div>
            )}

            {provider && !isStreaming && (
              <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-white/10 text-[10px] text-gray-400 dark:text-gray-500">
                {getProviderIcon(provider)}
                <span>via {getProviderName(provider)}</span>
              </div>
            )}
          </div>
        )}

        {/* Suggested Next Questions - Shows only after response */}
        {!isStreaming && allSuggestions.length > 0 && onFollowUp && (
          <div className="mt-4 px-1 w-full animate-fade-in">
            <div className="flex items-center gap-1 text-[10px] text-[#F95F9E] mb-1.5 font-semibold uppercase tracking-wider">
              <Sparkles size={9} className="text-[#F95F9E] animate-pulse" /> Suggested Next Questions
            </div>
            <div className="flex flex-wrap gap-2">
              {allSuggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp(sug)}
                  className="text-left text-sm bg-white/40 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-[#F95F9E] dark:hover:border-[#F95F9E] px-4 py-2.5 rounded-2xl text-gray-700 dark:text-gray-200 hover:text-[#F95F9E] dark:hover:text-[#F95F9E] hover:bg-[#F95F9E]/10 hover:shadow-[0_0_12px_rgba(249,95,158,0.2)] dark:hover:shadow-[0_0_12px_rgba(249,95,158,0.3)] transition-all duration-300 cursor-pointer"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isStreaming && confidence_low && allSuggestions.length === 0 && (
          <div className="mt-1 px-1 text-[10px] text-yellow-600 dark:text-yellow-400">
            ⚠️ Low confidence — try rephrasing or uploading a more complete document.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatInterface({ sendMessageRef, loadedSession, onNewChat, onToggleSidebar }) {
  const [messages, setMessages] = useState([]);
  const [searchParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const sessionIdRef = useRef(null);
  const responseAccumulatorRef = useRef('');

  const { selectedDocs, saveSession, startNewSession, currentSessionId } = useChatContext();
  const dialog = useDialog();

  useEffect(() => {
  if (currentSessionId) {
    setMessages([]);
    setLoading(false);
    setInput('');
  }
}, [currentSessionId]);

  // Load historical session
  useEffect(() => {
    if (!loadedSession) return;
    const msgs = (loadedSession.messages || []).map(m => ({
      role: m.role,
      content: m.content || '',
      provider: m.metadata?.provider || null,
      metadata: m.metadata || {},
      streaming: false,
      error: false,
      afterSuggestions: [],
    }));
    setMessages(msgs);
    sessionIdRef.current = loadedSession.id;
  }, [loadedSession]);

  // Expose sendMessage
  useEffect(() => {
    if (sendMessageRef) sendMessageRef.current = sendMessage;
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Textarea auto-resize
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  // Initial suggestions for empty state
  useEffect(() => {
    if (selectedDocs.length === 0) {
      setSuggestedQuestions([]);
      return;
    }
    if (messages.length > 0) return;

    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        const result = await chatAPI.getSuggestedQuestions(selectedDocs);
        if (result?.questions?.length > 0) {
          setSuggestedQuestions(result.questions.slice(0, 4));
        } else {
          setSuggestedQuestions([]);
        }
      } catch {
        setSuggestedQuestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [selectedDocs.join(','), messages.length]);

  // Generate suggestions after response
  const generateAfterSuggestions = useCallback(async (history = []) => {
    try {
      const result = await chatAPI.getSuggestedQuestions(selectedDocs, history);
      return result?.questions?.length > 0 ? result.questions.slice(0, 4) : [];
    } catch {
      return [];
    }
  }, [selectedDocs]);

  // Core sendMessage
  const sendMessage = async (text) => {
    const userMessage = text.trim();
    if (!userMessage || loading) return;

    setInput('');
    setLoading(true);

    if (!sessionIdRef.current) {
      sessionIdRef.current = startNewSession();
    }

    const history = messages.map(m => ({ role: m.role, content: m.content }));
    const nextMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(nextMessages);

    if (isCasualMessage(userMessage)) {
      const reply = getCasualReply();
      setTimeout(() => {
        const finalMessages = [...nextMessages, { role: 'assistant', content: reply, provider: null, streaming: false }];
        setMessages(finalMessages);
        setLoading(false);
        saveSession(finalMessages, sessionIdRef.current);
      }, 350);
      return;
    }

    if (selectedDocs.length === 0) {
      dialog.alert('Please select a document from the left panel before asking a question.');
      setLoading(false);
      return;
    }

    const withPlaceholder = [...nextMessages, { role: 'assistant', content: '', provider: null, streaming: true, afterSuggestions: [] }];
    setMessages(withPlaceholder);
    responseAccumulatorRef.current = '';

    try {
      await chatAPI.sendMessage(
        userMessage,
        history,
        selectedDocs.length > 0 ? selectedDocs : null,

        (chunk) => {
          responseAccumulatorRef.current += chunk;
          const currentText = sanitizeStreamingText(responseAccumulatorRef.current);
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: currentText, streaming: true };
            }
            return updated;
          });
        },

        (metadata) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, metadata, provider: metadata.provider };
            }
            return updated;
          });
        },

        (error) => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content || 'Response interrupted.', error: true, streaming: false };
            }
            return updated;
          });
        }
      );
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: 'Something went wrong.', error: true, streaming: false };
        }
        return updated;
      });
    } finally {
      setLoading(false);

      const finalContent = sanitizeStreamingText(responseAccumulatorRef.current);

      // Generate suggested questions based on document chunks and context-aware history
      const finalAssistantMsg = { role: 'assistant', content: finalContent };
      const currentFullHistory = [...nextMessages, finalAssistantMsg];
      const newSuggestions = await generateAfterSuggestions(currentFullHistory);

      let finalMessages = [];
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant') {
          updated[updated.length - 1] = { ...last, content: finalContent, streaming: false, afterSuggestions: newSuggestions };
        }
        finalMessages = updated;
        return updated;
      });

      setTimeout(() => {
        saveSession(finalMessages.length > 0 ? finalMessages : messages, sessionIdRef.current);
      }, 100);
    }
  };

  const handleSend = () => sendMessage(input);
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const placeholderText = selectedDocs.length > 1
    ? `Ask across ${selectedDocs.length} documents...`
    : selectedDocs.length === 1
      ? 'Ask a question about this document...'
      : 'Select a document, then ask a question...';

  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden bg-transparent dark:bg-transparent">

      {/* Header */}
      <div className="bg-primary text-white py-3 px-4 sm:px-6 shadow-sm z-10 flex flex-wrap gap-3 items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-bold text-base sm:text-lg min-w-0">
          <Bot size={20} className="shrink-0" />
          <span className="truncate">Chat with Document</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            onClick={() => {
              try {
                exportChatToPdf(messages, selectedDocs.length > 0 ? `${selectedDocs.length} document(s)` : 'Document');
              } catch (err) {
                dialog.alert('Export failed: ' + err.message);
              }
            }}
            disabled={messages.length === 0}
            className="flex items-center justify-center gap-1.5 h-9 px-3 text-xs sm:px-3.5 sm:text-sm font-medium rounded-full border border-white/40 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            <Download size={14} className="shrink-0" />
            <span className="truncate">Export PDF</span>
          </button>
          <button
            onClick={onNewChat}
            className="flex items-center justify-center gap-1.5 h-9 px-3 text-xs sm:px-3.5 sm:text-sm font-medium rounded-full border border-white/40 hover:bg-white/15 transition-all duration-200"
          >
            <PlusCircle size={14} className="shrink-0" />
            <span className="truncate">New Chat</span>
          </button>
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="lg:hidden flex items-center justify-center gap-1.5 h-9 px-3 text-xs sm:px-3.5 sm:text-sm font-medium rounded-full border border-white/40 hover:bg-white/15 transition-all duration-200"
              aria-label="Toggle Sidebar"
            >
              <Menu size={14} className="shrink-0" />
              <span className="truncate">Menu</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-gray-400 dark:opacity-60">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot size={32} className="text-primary" />
            </div>
            <p className="text-base font-medium">
              {selectedDocs.length > 0
                ? `${selectedDocs.length} document(s) selected — ask anything!`
                : 'Select a document from the left panel to start'}
            </p>

            {selectedDocs.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {loadingSuggestions ? (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Sparkles size={12} className="animate-pulse text-primary" />
                    Generating questions for this document…
                  </div>
                ) : (
                  suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(q)}
                      className="text-xs bg-white/40 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 hover:border-[#F95F9E] dark:hover:border-[#F95F9E] text-gray-700 dark:text-gray-200 hover:text-[#F95F9E] dark:hover:text-[#F95F9E] hover:bg-[#F95F9E]/10 hover:shadow-[0_0_12px_rgba(249,95,158,0.2)] dark:hover:shadow-[0_0_12px_rgba(249,95,158,0.3)] px-3.5 py-2.5 rounded-xl transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      {q}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {messages.map((msg, idx) =>
              msg.role === 'user'
                ? <UserMessage key={idx} content={msg.content} />
                : <AssistantMessage
                    key={idx}
                    content={msg.content}
                    provider={msg.provider}
                    error={msg.error}
                    isStreaming={msg.streaming}
                    metadata={msg.metadata}
                    afterSuggestions={msg.afterSuggestions || []}
                    onFollowUp={(q) => sendMessage(q)}
                  />
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 px-4 md:px-10 py-4 bg-transparent dark:bg-transparent border-t border-[#e91e8c]/10 dark:border-white/10">
        <div className="max-w-3xl mx-auto flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText}
            disabled={loading}
            rows={1}
            className="flex-1 bg-white/90 border-[1.5px] border-[#e91e8c]/20 shadow-[0_2px_12px_rgba(233,30,140,0.08)] rounded-2xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#e91e8c] focus:ring-0 focus:shadow-[0_0_0_3px_rgba(233,30,140,0.1)] dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:focus:border-primary resize-none transition-all"
            style={{ minHeight: '44px', maxHeight: '140px', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-primary hover:bg-primary/90 disabled:bg-gray-200 dark:disabled:bg-white/10 disabled:text-gray-400 text-white transition-all shadow-sm hover:shadow-md"
          >
            <Send size={18} className="ml-0.5" />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2">
          NEXORA answers only from your selected documents.
        </p>
      </div>

      <style>{`textarea::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}