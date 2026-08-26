import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, User, ShoppingBag, Loader2, CheckCheck } from 'lucide-react';
import { API_URL } from '../config/api.js';

export default function ChatWidget({ defaultVendeurId, defaultSujet, onClose, inlineMode = false }) {
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(inlineMode);
  
  const token = localStorage.getItem('token');
  const userId = Number(localStorage.getItem('userId'));
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchConversations();
    }
  }, [token]);

  useEffect(() => {
    if (activeConvo) {
      fetchMessages(activeConvo.id);
      
      // Auto-poll messages every 6 seconds for semi-real-time chat
      const interval = setInterval(() => {
        fetchMessages(activeConvo.id, false);
      }, 6000);
      
      return () => clearInterval(interval);
    }
  }, [activeConvo]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    setListLoading(true);
    try {
      const response = await fetch(`${API_URL}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setConversations(data.data);
        
        // If we were passed a default seller, start/find that conversation
        if (defaultVendeurId) {
          handleStartNewConvo(defaultVendeurId, defaultSujet);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setListLoading(false);
    }
  };

  const handleStartNewConvo = async (vendeurId, sujet) => {
    try {
      const response = await fetch(`${API_URL}/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ vendeurId, sujet }),
      });
      const data = await response.json();
      if (data.success) {
        // Add to list if not present
        if (!conversations.some((c) => c.id === data.data.id)) {
          setConversations([data.data, ...conversations]);
        }
        setActiveConvo(data.data);
      }
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };

  const fetchMessages = async (convoId, showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/chat/conversations/${convoId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setMessages(data.data);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvo) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const response = await fetch(`${API_URL}/chat/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ conversationId: activeConvo.id, contenu: messageText }),
      });
      const data = await response.json();
      if (data.success) {
        setMessages([...messages, data.data]);
        
        // Update local convo summary list
        setConversations(
          conversations.map((c) =>
            c.id === activeConvo.id
              ? { ...c, dernierMessage: messageText, dateDernierMessage: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  if (!token) return null;

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (onClose && isOpen) onClose();
  };

  return (
    <>
      {!inlineMode && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-24 bg-teal-700 hover:bg-teal-800 text-white rounded-full p-4 shadow-xl z-40 flex items-center justify-center transition"
          aria-label="Messagerie"
        >
          <MessageSquare size={24} />
          {conversations.some((c) => c.messages?.some((m) => !m.lu && m.expediteurId !== userId)) && (
            <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
          )}
        </button>
      )}

      {isOpen && (
        <div className={inlineMode ? "w-full h-[600px] border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-soft" : "fixed inset-x-3 bottom-20 h-[70vh] max-h-[550px] md:inset-x-auto md:right-6 md:bottom-24 md:w-96 md:h-[550px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col z-50 overflow-hidden font-sans"}>
          {/* Header */}
          <div className="bg-[#172B4D] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare size={20} />
              <h2 className="font-bold text-sm">Messagerie here.tn</h2>
            </div>
            {!inlineMode && (
              <button onClick={toggleOpen} className="text-white hover:text-teal-100">
                <X size={20} />
              </button>
            )}
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Conversation list (only show if no active convo or if on large screen/list view) */}
            {(!activeConvo || inlineMode) && (
              <div className={`flex-col bg-slate-50 border-r border-slate-100 ${activeConvo ? 'hidden md:flex w-1/3' : 'flex w-full'}`}>
                <div className="p-3 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Discussions</p>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {listLoading && (
                    <div className="p-4 text-center">
                      <Loader2 className="animate-spin mx-auto text-teal-600" size={24} />
                    </div>
                  )}

                  {!listLoading && conversations.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      Aucune conversation ouverte.
                    </div>
                  )}

                  {conversations.map((convo) => {
                    const isClient = convo.clientId === userId;
                    const contact = isClient ? convo.vendeur : convo.client;
                    const contactName = contact ? `${contact.prenom} ${contact.nom}` : `Utilisateur #${isClient ? convo.vendeurId : convo.clientId}`;
                    const boutiqueName = !isClient ? '' : contact?.boutique?.nom || 'Vendeur';

                    return (
                      <button
                        key={convo.id}
                        onClick={() => setActiveConvo(convo)}
                        className={`w-full text-left p-3.5 hover:bg-slate-100 transition flex items-start gap-2.5 ${
                          activeConvo?.id === convo.id ? 'bg-teal-50/50' : ''
                        }`}
                      >
                        <span className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs uppercase flex-shrink-0">
                          {contactName.substring(0, 2)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <h4 className="font-bold text-xs text-slate-800 truncate">
                              {boutiqueName || contactName}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              {new Date(convo.dateDernierMessage).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-semibold truncate mb-0.5">{convo.sujet}</p>
                          <p className="text-xs text-slate-600 truncate">{convo.dernierMessage}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {activeConvo && (
              <div className="flex-1 flex flex-col bg-white">
                {/* Active contact bar */}
                <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveConvo(null)}
                      className="text-slate-500 hover:text-slate-700 md:hidden text-xs font-semibold mr-1"
                    >
                      ← Liste
                    </button>
                    <div>
                      <h3 className="font-bold text-xs text-slate-800">
                        {activeConvo.clientId === userId
                          ? activeConvo.vendeur?.boutique?.nom || `${activeConvo.vendeur?.prenom} ${activeConvo.vendeur?.nom}`
                          : `${activeConvo.client?.prenom} ${activeConvo.client?.nom}`}
                      </h3>
                      <p className="text-[10px] text-slate-400 italic truncate max-w-[180px]">
                        Sujet: {activeConvo.sujet}
                      </p>
                    </div>
                  </div>
                  {inlineMode && (
                    <button onClick={() => setActiveConvo(null)} className="text-xs text-slate-400 hover:text-slate-600 hidden md:block">
                      Fermer la discussion
                    </button>
                  )}
                </div>

                {/* Message stream */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/30">
                  {loading && (
                    <div className="text-center py-4">
                      <Loader2 className="animate-spin mx-auto text-teal-600" size={20} />
                    </div>
                  )}

                  {!loading && messages.map((msg) => {
                    const isMe = msg.expediteurId === userId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                            isMe
                              ? 'bg-teal-700 text-white rounded-tr-none'
                              : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                          }`}
                        >
                          <p>{msg.contenu}</p>
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className={`text-[9px] ${isMe ? 'text-teal-200' : 'text-slate-400'}`}>
                              {new Date(msg.dateEnvoi).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isMe && (
                              <CheckCheck size={10} className={msg.lu ? 'text-sky-300' : 'text-teal-300'} />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Sender Form */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-100 flex gap-2">
                  <input
                    type="text"
                    placeholder="Écrivez votre message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 text-xs border border-slate-200 px-4 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-teal-700 focus:border-transparent bg-slate-50/50"
                  />
                  <button
                    type="submit"
                    className="bg-teal-700 hover:bg-teal-800 text-white rounded-full p-2.5 shadow-md transition flex-shrink-0"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
