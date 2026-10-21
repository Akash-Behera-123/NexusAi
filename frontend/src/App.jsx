
import {
  SignInButton,
  SignUpButton,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import AuthScreen from './AuthScreen.jsx'
import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

function App() {
  const path = window.location.pathname
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const { user } = useUser()

  // Chat state
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [conversationId, setConversationId] = useState(null)
  const [activeChat, setActiveChat] = useState('New conversation')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const chatEndRef = useRef(null)

  // Conversation history
  const [conversations, setConversations] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [conversationSearch, setConversationSearch] = useState('')
  const [deletingConversation, setDeletingConversation] = useState(null)
  const [renamingConversation, setRenamingConversation] = useState(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [savingRename, setSavingRename] = useState(false)

  // Navigation and documents
  const [activeView, setActiveView] = useState('assistant')
  const [documents, setDocuments] = useState([])
  const [documentsLoading, setDocumentsLoading] = useState(false)
  const [refreshingIndex, setRefreshingIndex] = useState(false)
  const [documentError, setDocumentError] = useState('')
  const [documentMessage, setDocumentMessage] = useState('')
  const [totalChunks, setTotalChunks] = useState(0)
  // Token usage analytics
const [tokenUsage, setTokenUsage] = useState({
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
  request_count: 0,
})
const [analyticsLoading, setAnalyticsLoading] = useState(false)
const [analyticsError, setAnalyticsError] = useState('')

  // PDF upload
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadError, setUploadError] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [deletingDocument, setDeletingDocument] = useState(null)

  // Message actions
  const [copiedMessageIndex, setCopiedMessageIndex] = useState(null)
  const [editingMessageIndex, setEditingMessageIndex] = useState(null)
  const [editedQuestion, setEditedQuestion] = useState('')

  // --------------------------------------------------
  // Authentication
  // --------------------------------------------------

  const getAuthConfig = useCallback(async () => {
    const token = await getToken()

    if (!token) {
      throw new Error('Your session has expired. Please sign in again.')
    }

    return {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  }, [getToken])



  //------------------------------------------------------------------------------
  //fetch token usage analytics

   const fetchTokenAnalytics = useCallback(async () => {
  if (!isSignedIn) return

  setAnalyticsLoading(true)
  setAnalyticsError('')

  try {
    const config = await getAuthConfig()
    const response = await axios.get(
      `${API_URL}/analytics`,
      config
    )

    setTokenUsage(response.data)
  } catch (err) {
    console.error('Token analytics error:', err)
    setAnalyticsError(
      err.response?.data?.detail ||
      err.message ||
      'Failed to load token analytics.'
    )
  } finally {
    setAnalyticsLoading(false)
  }
}, [isSignedIn, getAuthConfig])


useEffect(() => {
  if (isSignedIn) {
    fetchTokenAnalytics()
  }
}, [isSignedIn, fetchTokenAnalytics])


  // --------------------------------------------------
  // Fetch conversations
  // --------------------------------------------------

  const fetchConversations = useCallback(async () => {
    if (!isLoaded || !isSignedIn) return

    setHistoryLoading(true)
    setHistoryError('')

    try {
      const config = await getAuthConfig()
      const response = await axios.get(
        `${API_URL}/conversations`,
        config,
      )

      setConversations(
        Array.isArray(response.data) ? response.data : [],
      )
    } catch (err) {
      console.error(
        'Failed to load conversations:',
        err.response?.data || err.message,
      )

      setHistoryError(
        err.response?.status === 401
          ? 'Your session expired. Please sign in again.'
          : err.response?.data?.detail ||
              'Could not load conversation history. Check the backend connection.',
      )
    } finally {
      setHistoryLoading(false)
    }
  }, [isLoaded, isSignedIn, getAuthConfig])

  // --------------------------------------------------
  // Delete conversation
  // --------------------------------------------------

  async function handleDeleteConversation(conversation) {
    const title = conversation.title || 'Untitled conversation'

    if (
      !window.confirm(
        `Delete "${title}" and all its messages? This cannot be undone.`,
      )
    ) {
      return
    }

    setDeletingConversation(conversation.id)
    setHistoryError('')

    try {
      const config = await getAuthConfig()

      await axios.delete(
        `${API_URL}/conversations/${conversation.id}`,
        config,
      )

      if (conversationId === conversation.id) {
        setConversationId(null)
        setMessages([])
        setQuestion('')
        setActiveChat('New conversation')
        setError('')
      }

      await fetchConversations()
    } catch (err) {
      console.error(
        'Failed to delete conversation:',
        err.response?.data || err.message,
      )

      setHistoryError(
        err.response?.data?.detail ||
          'Could not delete the conversation. Please try again.',
      )
    } finally {
      setDeletingConversation(null)
    }
  }

  // --------------------------------------------------
  // Rename conversation
  // --------------------------------------------------

  async function handleRenameConversation(conversation) {
    const title = renameTitle.trim()

    if (!title) {
      setHistoryError('Conversation title cannot be empty.')
      return
    }

    if (title.length > 100) {
      setHistoryError('Title must be 100 characters or fewer.')
      return
    }

    setSavingRename(true)
    setHistoryError('')

    try {
      const config = await getAuthConfig()

      const response = await axios.patch(
        `${API_URL}/conversations/${conversation.id}`,
        { title },
        config,
      )

      setConversations((previous) =>
        previous.map((item) =>
          item.id === conversation.id
            ? { ...item, title: response.data.title }
            : item,
        ),
      )

      if (conversationId === conversation.id) {
        setActiveChat(response.data.title)
      }

      setRenamingConversation(null)
      setRenameTitle('')
    } catch (err) {
      console.error(
        'Failed to rename conversation:',
        err.response?.data || err.message,
      )

      setHistoryError(
        err.response?.data?.detail ||
          'Could not rename conversation. Please try again.',
      )
    } finally {
      setSavingRename(false)
    }
  }

  // --------------------------------------------------
  // Export conversation
  // --------------------------------------------------

  function handleExportConversation() {
    if (messages.length === 0) {
      setError('There are no messages to export.')
      return
    }

    const content = messages
      .map((message) => {
        const role =
          message.role === 'assistant' ? 'NEXUS AI' : 'You'

        return `${role}:\n${message.content}`
      })
      .join('\n\n------------------------------\n\n')

    const blob = new Blob([content], {
      type: 'text/plain;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = `nexus-conversation-${new Date()
      .toISOString()
      .slice(0, 10)}.txt`

    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  // --------------------------------------------------
  // Test authentication
  // --------------------------------------------------

  async function testClerkAuth() {
    try {
      const config = await getAuthConfig()

      const response = await axios.get(
        `${API_URL}/auth-test`,
        config,
      )

      console.log('Clerk authentication test:', response.data)
      alert('Authentication successful! Check the browser console.')
    } catch (err) {
      console.error(
        'Clerk authentication test failed:',
        err.response?.data || err.message,
      )

      alert(
        err.response?.data?.detail ||
          err.message ||
          'Authentication test failed.',
      )
    }
  }

  // --------------------------------------------------
  // Load history after sign-in
  // --------------------------------------------------

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchConversations()
    }
  }, [isLoaded, isSignedIn, fetchConversations])

  // --------------------------------------------------
  // Scroll to latest message
  // --------------------------------------------------

  useEffect(() => {
    if (activeView === 'assistant') {
      chatEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      })
    }
  }, [messages, loading, activeView])

  // --------------------------------------------------
  // Fetch documents
  // --------------------------------------------------

  const fetchDocuments = useCallback(async () => {
    if (!isSignedIn) return

    setDocumentsLoading(true)
    setDocumentError('')

    try {
      const config = await getAuthConfig()

      const response = await axios.get(
        `${API_URL}/documents`,
        config,
      )

      setDocuments(
        Array.isArray(response.data.documents)
          ? response.data.documents
          : [],
      )

      setTotalChunks(response.data.total_chunks ?? 0)
    } catch (err) {
      console.error(
        'Failed to load documents:',
        err.response?.data || err.message,
      )

      setDocumentError(
        err.response?.data?.detail ||
          err.message ||
          'Could not load documents. Check that the backend is running.',
      )
    } finally {
      setDocumentsLoading(false)
    }
  }, [isSignedIn, getAuthConfig])

  // --------------------------------------------------
  // Refresh FAISS index
  // --------------------------------------------------

  async function refreshDocumentIndex() {
    if (refreshingIndex || uploading || deletingDocument) return

    setRefreshingIndex(true)
    setDocumentError('')
    setDocumentMessage('')

    try {
      const config = await getAuthConfig()

      const response = await axios.post(
        `${API_URL}/documents/refresh`,
        {},
        config,
      )

      setDocumentMessage(
        response.data.message || 'Index refreshed successfully.',
      )

      const documentsResponse = await axios.get(
        `${API_URL}/documents`,
        config,
      )

      setDocuments(
        Array.isArray(documentsResponse.data.documents)
          ? documentsResponse.data.documents
          : [],
      )

      setTotalChunks(documentsResponse.data.total_chunks ?? 0)
    } catch (err) {
      console.error(
        'Index refresh failed:',
        err.response?.data || err.message,
      )

      setDocumentError(
        err.response?.data?.detail ||
          err.message ||
          'Could not refresh the document index.',
      )
    } finally {
      setRefreshingIndex(false)
    }
  }

  // --------------------------------------------------
  // Upload PDF
  // --------------------------------------------------

  async function handleDocumentUpload() {
    if (!selectedFile) {
      setUploadError('Please select a PDF file first.')
      return
    }

    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are allowed.')
      return
    }

    if (uploading || refreshingIndex || deletingDocument) return

    setUploading(true)
    setUploadError('')
    setUploadMessage('')
    setDocumentError('')
    setDocumentMessage('')

    try {
      const config = await getAuthConfig()
      const formData = new FormData()

      formData.append('file', selectedFile)

      const response = await axios.post(
        `${API_URL}/documents/upload`,
        formData,
        config,
      )

      setTotalChunks(response.data.total_chunks ?? 0)
      setSelectedFile(null)

      const fileInput = document.getElementById('pdf-upload-input')
      if (fileInput) fileInput.value = ''

      setUploadMessage(
        `${response.data.filename} uploaded and indexed successfully.`,
      )

      await fetchDocuments()
    } catch (err) {
      console.error(
        'Document upload failed:',
        err.response?.data || err.message,
      )

      setUploadError(
        err.response?.data?.detail ||
          err.message ||
          'Upload failed. Please check the backend and try again.',
      )
    } finally {
      setUploading(false)
    }
  }

  // --------------------------------------------------
  // Delete PDF
  // --------------------------------------------------

  async function handleDeleteDocument(document) {
    const filename = document?.name

    if (!filename) {
      setDocumentError(
        'Cannot delete this file because its filename is missing.',
      )
      return
    }

    if (uploading || refreshingIndex || deletingDocument) return

    if (
      !window.confirm(
        `Delete "${filename}" from your knowledge base?\n\nThis will remove the PDF from your document library and rebuild your FAISS index. This action cannot be undone.`,
      )
    ) {
      return
    }

    setDeletingDocument(filename)
    setDocumentError('')
    setDocumentMessage('')

    try {
      const config = await getAuthConfig()

      const response = await axios.delete(
        `${API_URL}/documents/${encodeURIComponent(filename)}`,
        config,
      )

      setDocuments((previous) =>
        previous.filter((item) => item.name !== filename),
      )

      if (response.data.total_chunks != null) {
        setTotalChunks(response.data.total_chunks)
      }

      setDocumentMessage(
        response.data.message || `"${filename}" was deleted successfully.`,
      )

      await fetchDocuments()
    } catch (err) {
      console.error(
        'Document deletion failed:',
        err.response?.data || err.message,
      )

      setDocumentError(
        err.response?.data?.detail ||
          err.message ||
          `Could not delete "${filename}". Please try again.`,
      )
    } finally {
      setDeletingDocument(null)
    }
  }

  // --------------------------------------------------
  // Navigation
  // --------------------------------------------------

  function openKnowledgeBase() {
    setActiveView('knowledge')
    fetchDocuments()
  }

  async function openAssistant() {
    setActiveView('assistant')
    await fetchConversations()
  }

  async function openAnalytics() {
    setActiveView('analytics')

    await Promise.all([
      fetchConversations(),
      fetchDocuments(),
    ])
  }

  async function startNewChat() {
    if (loading) return

    setMessages([])
    setQuestion('')
    setConversationId(null)
    setActiveChat('New conversation')
    setError('')
    setEditingMessageIndex(null)
    setEditedQuestion('')
    setActiveView('assistant')

    await fetchConversations()
  }

  // --------------------------------------------------
  // Open saved conversation
  // --------------------------------------------------

  async function openConversation(conversation) {
    if (loading) return

    setError('')
    setActiveView('assistant')

    try {
      const config = await getAuthConfig()

      const response = await axios.get(
        `${API_URL}/conversations/${conversation.id}/messages`,
        config,
      )

      const data = response.data

      setConversationId(data.conversation_id)
      setActiveChat(
        data.title || conversation.title || 'Conversation',
      )

      setMessages(
        (data.messages || []).map((message) => ({
          role: message.role,
          content: message.content,
          sources: Array.isArray(message.sources)
            ? message.sources
            : [],
        })),
      )

      setQuestion('')
      setEditingMessageIndex(null)
      setEditedQuestion('')
    } catch (err) {
      console.error(
        'Failed to load conversation:',
        err.response?.data || err.message,
      )

      setError(
        err.response?.data?.detail ||
          err.message ||
          `Could not load conversation (${err.response?.status || 'network error'}).`,
      )
    }
  }

  // --------------------------------------------------
  // Send question to RAG assistant
  // --------------------------------------------------

  async function handleSubmit(event) {
    event.preventDefault()

    const questionText = question.trim()

    if (!questionText || loading) return

    setError('')
    setLoading(true)
    setQuestion('')

    setMessages((previous) => [
      ...previous,
      {
        role: 'user',
        content: questionText,
        sources: [],
      },
    ])

    try {
      const config = await getAuthConfig()

      const response = await axios.post(
        `${API_URL}/ask-docs`,
        {
          question: questionText,
          conversation_id: conversationId,
        },
        config,
      )

      const data = response.data

      setConversationId(data.conversation_id)

      setActiveChat((previous) =>
        previous === 'New conversation'
          ? questionText.slice(0, 50)
          : previous,
      )

      setMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          content: data.response,
          sources: data.sources ?? [],
        },
      ])

      await fetchConversations()
    } catch (err) {
      console.error(
        'NEXUS AI request failed:',
        err.response?.data || err.message,
      )

      setError(
        err.response?.data?.detail ||
          err.message ||
          'Could not connect to NEXUS AI. Check that the backend is running.',
      )
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------
  // Edit and resend latest question
  // --------------------------------------------------

  async function handleEditAndResend(updatedQuestion) {
    const newQuestion = updatedQuestion.trim()

    if (
      loading ||
      editingMessageIndex === null ||
      !conversationId ||
      !newQuestion
    ) {
      return
    }

    const editIndex = editingMessageIndex
    const originalQuestion = messages[editIndex]?.content
    const nextMessage = messages[editIndex + 1]

    if (
      !originalQuestion ||
      nextMessage?.role !== 'assistant' ||
      editIndex !== messages.length - 2
    ) {
      setError('Only the latest question can be edited.')
      return
    }

    setError('')
    setLoading(true)

    try {
      const config = await getAuthConfig()

      const response = await axios.post(
        `${API_URL}/ask-docs`,
        {
          question: newQuestion,
          conversation_id: conversationId,
          edit: true,
          original_question: originalQuestion,
        },
        config,
      )

      const data = response.data

      setMessages((previous) => {
        const updated = [...previous]

        updated[editIndex] = {
          ...updated[editIndex],
          content: newQuestion,
          sources: [],
        }

        updated[editIndex + 1] = {
          role: 'assistant',
          content: data.response,
          sources: data.sources ?? [],
        }

        return updated.slice(0, editIndex + 2)
      })

      setEditingMessageIndex(null)
      setEditedQuestion('')

      await fetchConversations()
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Failed to edit the question and generate a new response.',
      )
    } finally {
      setLoading(false)
    }
  }

  function useSuggestion(text) {
    setQuestion(text)
    setError('')
  }

  // --------------------------------------------------
  // Regenerate latest answer
  // --------------------------------------------------

  async function handleRegenerate() {
    if (loading || !conversationId || messages.length < 2) return

    const lastUserIndex = messages
      .map((message) => message.role)
      .lastIndexOf('user')

    if (lastUserIndex === -1) return

    const questionText = messages[lastUserIndex].content

    setError('')
    setLoading(true)

    try {
      const config = await getAuthConfig()

      const response = await axios.post(
        `${API_URL}/ask-docs`,
        {
          question: questionText,
          conversation_id: conversationId,
          regenerate: true,
        },
        config,
      )

      const data = response.data

      setConversationId(data.conversation_id)

      setMessages((previous) => {
        const userIndex = previous
          .map((message) => message.role)
          .lastIndexOf('user')

        if (userIndex === -1) return previous

        return [
          ...previous.slice(0, userIndex + 1),
          {
            role: 'assistant',
            content: data.response,
            sources: data.sources ?? [],
          },
        ]
      })

      await fetchConversations()
    } catch (err) {
      console.error(
        'Regenerate failed:',
        err.response?.data || err.message,
      )

      setError(
        err.response?.data?.detail ||
          err.message ||
          'Could not regenerate the response.',
      )
    } finally {
      setLoading(false)
    }
  }

  // --------------------------------------------------
  // Authentication guards
  // --------------------------------------------------

  if (!isLoaded) {
    return <div className="auth-screen">Loading NEXUS AI...</div>
  }

  if (
    path === '/sign-in' ||
    path.startsWith('/sign-in/') ||
    path === '/sign-up' ||
    path.startsWith('/sign-up/')
  ) {
    return <AuthScreen />
  }

  if (!isSignedIn) {
    return (
      <div className="auth-screen">
        <div className="auth-welcome">
          <h1>Welcome to NEXUS AI</h1>
          <p>Sign in to access your AI workspace.</p>

          <div className="auth-actions">
            <SignInButton mode="redirect">
              <button type="button">Sign in</button>
            </SignInButton>

            <SignUpButton mode="redirect">
              <button type="button">Create account</button>
            </SignUpButton>
          </div>
        </div>
      </div>
    )
  }

  // --------------------------------------------------
  // Main application
  // --------------------------------------------------

  const filteredConversations = conversations.filter((conversation) =>
    (conversation.title || 'Untitled conversation')
      .toLowerCase()
      .includes(conversationSearch.trim().toLowerCase()),
  )

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>

          <div>
            <h1>NEXUS AI</h1>
            <span>INTELLIGENCE PLATFORM</span>
          </div>
        </div>

        <button
          className="new-chat"
          onClick={startNewChat}
          disabled={loading}
        >
          <span>＋</span> New conversation
        </button>

        <div className="sidebar-label">WORKSPACE</div>

        <button
          type="button"
          className={`nav-item ${
            activeView === 'assistant' ? 'active' : ''
          }`}
          onClick={openAssistant}
        >
          <span>◈</span> AI Assistant
        </button>

        <button
          type="button"
          className={`nav-item ${
            activeView === 'knowledge' ? 'active' : ''
          }`}
          onClick={openKnowledgeBase}
        >
          <span>▤</span> Knowledge base
        </button>

        <button
          type="button"
          className={`nav-item ${
            activeView === 'analytics' ? 'active' : ''
          }`}
          onClick={openAnalytics}
        >
          <span>▥</span> Analytics
        </button>

        <div className="sidebar-label">RECENT CONVERSATIONS</div>

        <input
          type="search"
          className="conversation-search"
          placeholder="Search conversations..."
          value={conversationSearch}
          onChange={(event) =>
            setConversationSearch(event.target.value)
          }
          aria-label="Search conversation history"
        />

        {historyLoading && (
          <div className="history-empty">Loading conversations...</div>
        )}

        {historyError && (
          <div className="history-empty" role="alert">
            {historyError}
            <button
              type="button"
              className="history-retry"
              onClick={fetchConversations}
            >
              Retry
            </button>
          </div>
        )}

        {!historyLoading &&
          !historyError &&
          filteredConversations.length === 0 && (
            <div className="history-empty">
              {conversationSearch.trim()
                ? 'No matching conversations'
                : 'No conversations yet'}
            </div>
          )}

        {!historyLoading &&
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`history-row ${
                conversationId === conversation.id ? 'selected' : ''
              }`}
            >
              {renamingConversation === conversation.id ? (
                <form
                  className="rename-conversation-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    handleRenameConversation(conversation)
                  }}
                >
                  <input
                    type="text"
                    value={renameTitle}
                    onChange={(event) =>
                      setRenameTitle(event.target.value)
                    }
                    maxLength={100}
                    autoFocus
                    aria-label="Conversation title"
                    disabled={savingRename}
                  />

                  <button type="submit" disabled={savingRename}>
                    {savingRename ? '...' : 'Save'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRenamingConversation(null)
                      setRenameTitle('')
                      setHistoryError('')
                    }}
                    disabled={savingRename}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className="history-item"
                    onClick={() => openConversation(conversation)}
                    disabled={loading || deletingConversation !== null}
                    title={conversation.title || 'Conversation'}
                  >
                    <span>◷</span>
                    <span className="history-title">
                      {conversation.title || 'Untitled conversation'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="rename-conversation-button"
                    onClick={() => {
                      setRenamingConversation(conversation.id)
                      setRenameTitle(conversation.title || '')
                      setHistoryError('')
                    }}
                    disabled={
                      deletingConversation !== null || savingRename
                    }
                    title="Rename conversation"
                  >
                    Rename
                  </button>

                  <button
                    type="button"
                    className="delete-conversation-button"
                    onClick={() => handleDeleteConversation(conversation)}
                    disabled={
                      deletingConversation !== null || savingRename
                    }
                    title="Delete conversation"
                  >
                    {deletingConversation === conversation.id
                      ? '...'
                      : 'Delete'}
                  </button>
                </>
              )}
            </div>
          ))}

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <strong>AI workspace</strong>
            <p>Powered by Gemini</p>
          </div>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="main-panel">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              Workspace <span>/</span>{' '}
              {activeView === 'assistant'
                ? 'AI Assistant'
                : activeView === 'knowledge'
                  ? 'Knowledge Base'
                  : 'Analytics'}
            </div>

            <h2>
              {activeView === 'assistant'
                ? activeChat
                : activeView === 'knowledge'
                  ? 'Knowledge Base'
                  : 'Analytics Overview'}
            </h2>
          </div>

          <div className="topbar-right">
            <span className="online">
              <i /> API workspace
            </span>

            {activeView === 'assistant' && (
              <button
                type="button"
                className="export-conversation-button"
                onClick={handleExportConversation}
                disabled={messages.length === 0}
                title="Export this conversation as a text file"
              >
                Export TXT
              </button>
            )}

            <button
              type="button"
              onClick={testClerkAuth}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #6366f1',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
              }}
            >
              Test API Auth
            </button>

            <div className="user-profile">
              <span className="user-name">
                {user?.firstName || user?.username || 'User'}
              </span>
              <UserButton />
            </div>
          </div>
        </header>

        {/* AI Assistant */}
        {activeView === 'assistant' ? (
          <>
            <section className="chat-area">
              {messages.length === 0 && (
                <div className="welcome">
                  <div className="welcome-symbol">✳</div>

                  <div className="eyebrow">
                    YOUR ENTERPRISE AI ASSISTANT
                  </div>

                  <h2>
                    Knowledge at your
                    <br />
                    <span>command.</span>
                  </h2>

                  <p>
                    Ask questions about your documents, find information
                    faster, and explore your organization's knowledge in
                    one place.
                  </p>

                  <div className="suggestions">
                    <button
                      type="button"
                      onClick={() =>
                        useSuggestion(
                          'How many days of annual leave do employees receive?',
                        )
                      }
                    >
                      <span>▤</span>
                      <div>
                        <strong>Employee policies</strong>
                        <small>Find answers in your handbook</small>
                      </div>
                      <b>↗</b>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        useSuggestion(
                          'What is the work-from-home policy?',
                        )
                      }
                    >
                      <span>⌂</span>
                      <div>
                        <strong>Workplace knowledge</strong>
                        <small>Explore company guidelines</small>
                      </div>
                      <b>↗</b>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        useSuggestion(
                          'How do I report a security incident?',
                        )
                      }
                    >
                      <span>◇</span>
                      <div>
                        <strong>Security and compliance</strong>
                        <small>Locate important procedures</small>
                      </div>
                      <b>↗</b>
                    </button>
                  </div>
                </div>
              )}

              {messages.length > 0 && (
                <div className="messages">
                  {messages.map((message, index) => (
                    <div
                      className={`message ${message.role}`}
                      key={`${conversationId ?? 'new'}-${index}-${message.role}`}
                    >
                      <div className="message-avatar">
                        {message.role === 'user' ? 'Y' : 'N'}
                      </div>

                      <div className="message-body">
                        <strong>
                          {message.role === 'user' ? 'You' : 'NEXUS AI'}
                        </strong>

                        {message.role === 'user' &&
                        editingMessageIndex === index ? (
                          <div className="edit-question-form">
                            <textarea
                              className="edit-question-textarea"
                              value={editedQuestion}
                              onChange={(event) =>
                                setEditedQuestion(event.target.value)
                              }
                              rows={3}
                              autoFocus
                              disabled={loading}
                              placeholder="Edit your question..."
                            />

                            <div className="edit-question-actions">
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() => {
                                  setEditingMessageIndex(null)
                                  setEditedQuestion('')
                                  setError('')
                                }}
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                disabled={
                                  loading ||
                                  !editedQuestion.trim() ||
                                  editedQuestion.trim() ===
                                    message.content?.trim()
                                }
                                onClick={() =>
                                  handleEditAndResend(editedQuestion)
                                }
                              >
                                {loading ? 'Generating...' : 'Save & resend'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="markdown-content">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                code({ children, className, ...props }) {
                                  const match = /language-(\w+)/.exec(
                                    className || '',
                                  )

                                  const isInline = !className

                                  return isInline ? (
                                    <code {...props} className={className}>
                                      {children}
                                    </code>
                                  ) : (
                                    <SyntaxHighlighter
                                      style={oneDark}
                                      language={match?.[1] || 'text'}
                                      PreTag="div"
                                    >
                                      {String(children).replace(/\n$/, '')}
                                    </SyntaxHighlighter>
                                  )
                                },

                                pre({ children }) {
                                  const extractText = (node) => {
                                    if (
                                      typeof node === 'string' ||
                                      typeof node === 'number'
                                    ) {
                                      return String(node)
                                    }

                                    if (Array.isArray(node)) {
                                      return node.map(extractText).join('')
                                    }

                                    if (node && typeof node === 'object') {
                                      return extractText(node.props?.children)
                                    }

                                    return ''
                                  }

                                  return (
                                    <div className="code-block-wrapper">
                                      <div className="code-block-toolbar">
                                        <span>Code</span>
                                        <button
                                          type="button"
                                          className="copy-code-button"
                                          onClick={async () => {
                                            try {
                                              await navigator.clipboard.writeText(
                                                extractText(children),
                                              )
                                            } catch (copyError) {
                                              console.error(
                                                'Failed to copy code:',
                                                copyError,
                                              )
                                            }
                                          }}
                                        >
                                          Copy code
                                        </button>
                                      </div>
                                      {children}
                                    </div>
                                  )
                                },
                              }}
                            >
                              {message.content || ''}
                            </ReactMarkdown>
                          </div>
                        )}

                        {message.role === 'user' &&
                          index === messages.length - 2 &&
                          editingMessageIndex !== index && (
                            <button
                              type="button"
                              className="copy-response-button"
                              disabled={loading || !conversationId}
                              onClick={() => {
                                setEditingMessageIndex(index)
                                setEditedQuestion(message.content || '')
                                setError('')
                              }}
                            >
                              Edit question
                            </button>
                          )}

                        {message.role === 'assistant' && (
                          <>
                            <button
                              type="button"
                              className="copy-response-button"
                              disabled={loading}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    message.content || '',
                                  )

                                  setCopiedMessageIndex(index)

                                  setTimeout(() => {
                                    setCopiedMessageIndex((current) =>
                                      current === index ? null : current,
                                    )
                                  }, 2000)
                                } catch (copyError) {
                                  console.error(
                                    'Failed to copy response:',
                                    copyError,
                                  )
                                }
                              }}
                            >
                              {copiedMessageIndex === index
                                ? 'Copied!'
                                : 'Copy response'}
                            </button>

                            {index === messages.length - 1 && (
                              <button
                                type="button"
                                className="copy-response-button"
                                onClick={handleRegenerate}
                                disabled={loading || !conversationId}
                              >
                                {loading
                                  ? 'Generating...'
                                  : 'Regenerate response'}
                              </button>
                            )}
                          </>
                        )}

                        {message.sources?.length > 0 && (
                          <div className="message-sources">
                            <strong>Sources</strong>

                            {message.sources.map((source, sourceIndex) => (
                              <div
                                className="message-source"
                                key={`${source.filename || source.document || 'source'}-${sourceIndex}`}
                              >
                                <span>
                                  {source.filename ||
                                    source.document ||
                                    'Document'}
                                </span>

                                {source.page != null && (
                                  <span> — Page {source.page}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {loading && (
                <div className="loading-message">
                  <span className="loading-dot" />
                  NEXUS AI is thinking...
                </div>
              )}

              {error && (
                <div className="error-message" role="alert">
                  <strong>Request failed</strong>
                  <p>{error}</p>
                </div>
              )}

              <div ref={chatEndRef} aria-hidden="true" />
            </section>

            <div className="composer-wrap">
              <form className="composer" onSubmit={handleSubmit}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask anything about your organization's knowledge..."
                  rows={2}
                  disabled={loading}
                  aria-label="Ask NEXUS AI a question"
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault()
                      event.currentTarget.form.requestSubmit()
                    }
                  }}
                />

                <div className="composer-footer">
                  <span>
                    <span className="sparkle">✳</span>
                    Answers grounded in your documents
                  </span>

                  <button
                    className="send-button"
                    type="submit"
                    disabled={loading || !question.trim()}
                    aria-label="Send message"
                  >
                    {loading ? '…' : '↑'}
                  </button>
                </div>
              </form>

              <p className="disclaimer">
                NEXUS AI can make mistakes. Verify important information
                with its cited sources.
              </p>
            </div>
          </>
        ) : activeView === 'knowledge' ? (
          /* Knowledge Base */
          <section className="knowledge-area">
            <div className="knowledge-heading">
              <div>
                <div className="eyebrow">WORKSPACE / DOCUMENTS</div>
                <h2>Knowledge Base</h2>
                <p>
                  Manage the documents powering your AI assistant.
                </p>
              </div>

              <button
                type="button"
                className="refresh-button"
                onClick={refreshDocumentIndex}
                disabled={
                  refreshingIndex ||
                  documentsLoading ||
                  uploading ||
                  Boolean(deletingDocument)
                }
              >
                {refreshingIndex ? 'Refreshing...' : '↻ Refresh index'}
              </button>
            </div>

            <div className="upload-panel">
              <div className="upload-copy">
                <h3>Add a PDF document</h3>
                <p>
                  Upload a PDF to add it to the NEXUS AI knowledge base.
                  The FAISS search index will rebuild automatically.
                </p>
              </div>

              <div className="upload-controls">
                <input
                  id="pdf-upload-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={
                    uploading ||
                    refreshingIndex ||
                    Boolean(deletingDocument)
                  }
                  onChange={(event) => {
                    setSelectedFile(event.target.files?.[0] || null)
                    setUploadError('')
                    setUploadMessage('')
                  }}
                />

                <button
                  type="button"
                  className="refresh-button upload-button"
                  disabled={
                    !selectedFile ||
                    uploading ||
                    refreshingIndex ||
                    Boolean(deletingDocument)
                  }
                  onClick={handleDocumentUpload}
                >
                  {uploading ? 'Uploading and indexing...' : 'Upload PDF'}
                </button>
              </div>

              {selectedFile && (
                <p className="selected-file">
                  Selected: {selectedFile.name}
                </p>
              )}

              {uploadError && (
                <div className="error-message" role="alert">
                  {uploadError}
                </div>
              )}

              {uploadMessage && (
                <div className="knowledge-success" role="status">
                  {uploadMessage}
                </div>
              )}
            </div>

            <div className="knowledge-stats">
              <div className="knowledge-stat">
                <span>PDF documents</span>
                <strong>{documents.length}</strong>
              </div>

              <div className="knowledge-stat">
                <span>Indexed chunks</span>
                <strong>{totalChunks}</strong>
              </div>

              <div className="knowledge-stat">
                <span>Search engine</span>
                <strong>FAISS</strong>
              </div>
            </div>

            {documentMessage && (
              <div className="knowledge-success" role="status">
                {documentMessage}
              </div>
            )}

            {documentError && (
              <div className="error-message" role="alert">
                {documentError}
              </div>
            )}

            <div className="document-panel">
              <div className="document-panel-heading">
                <div>
                  <h3>Your documents</h3>
                  <p>PDFs currently available to NEXUS AI</p>
                </div>
                <span>{documents.length} files</span>
              </div>

              {documentsLoading ? (
                <p className="knowledge-empty">Loading documents...</p>
              ) : documents.length === 0 ? (
                <p className="knowledge-empty">
                  No PDFs found. Upload a PDF using the section above.
                </p>
              ) : (
                documents.map((document) => {
                  const filename = document.name
                  const isDeleting = deletingDocument === filename
                  const sizeBytes = Number(document.size_bytes) || 0

                  return (
                    <div className="document-row" key={filename}>
                      <div className="document-icon">PDF</div>

                      <div className="document-details">
                        <strong>{filename || 'Unnamed PDF'}</strong>
                        <span>
                          {sizeBytes > 0
                            ? `${(sizeBytes / 1024).toFixed(1)} KB`
                            : 'PDF document'}
                        </span>
                      </div>

                      <span className="document-status">Available</span>

                      <button
                        type="button"
                        className="delete-document-button"
                        onClick={() => handleDeleteDocument(document)}
                        disabled={
                          !filename ||
                          uploading ||
                          refreshingIndex ||
                          Boolean(deletingDocument)
                        }
                        aria-label={`Delete ${filename || 'PDF'}`}
                        title={`Delete ${filename || 'PDF'}`}
                      >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <p className="knowledge-note">
              Uploaded PDFs are stored separately for each authenticated
              user. Deleting a PDF removes it from your library and
              rebuilds your document search index.
            </p>
          </section>
        ) : (
          /* Analytics */
          <section className="analytics-area">
            <div className="analytics-heading">
              <div>
                <div className="eyebrow">WORKSPACE / INSIGHTS</div>
                <h2>Analytics Overview</h2>
                <p>
                  Monitor your NEXUS AI workspace and knowledge base.
                </p>
              </div>

              <button
                type="button"
                className="refresh-button"
                onClick={openAnalytics}
                disabled={historyLoading || documentsLoading}
              >
                {historyLoading || documentsLoading
                  ? 'Refreshing...'
                  : '↻ Refresh data'}
              </button>
            </div>

            <div className="analytics-stats">
              <div className="analytics-card">
                <span>Total conversations</span>
                <strong>{conversations.length}</strong>
                <small>Saved conversations in your workspace</small>
              </div>

              <div className="analytics-card">
                <span>PDF documents</span>
                <strong>{documents.length}</strong>
                <small>Documents in your knowledge base</small>
              </div>

              <div className="analytics-card">
                <span>Indexed chunks</span>
                <strong>{totalChunks}</strong>
                <small>Chunks reported by the document index</small>
              </div>

              <div className="analytics-card">
                <span>AI engine</span>
                <strong>Gemini</strong>
                <small>Configured generation provider</small>
              </div>
            </div>

            
<div className="analytics-chart-panel">
  <div className="analytics-chart-heading">
    <div>
      <h3>Workspace Data Distribution</h3>
      <p>Overview of your saved conversations and PDF documents.</p>
    </div>
  </div>

  {conversations.length === 0 && documents.length === 0 ? (
    <p className="analytics-chart-empty">
      Add conversations or upload PDFs to see your data distribution.
    </p>
  ) : (
    <div className="analytics-pie-layout">
      <div className="analytics-pie">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={[
                { name: 'Conversations', value: conversations.length },
                { name: 'PDF Documents', value: documents.length },
              ].filter((item) => item.value > 0)}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={5}
              stroke="none"
            >
              {[
                '#8b5cf6',
                '#06b6d4',
              ].map((color, index) => (
                <Cell key={index} fill={color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#111a2a',
                border: '1px solid #334155',
                borderRadius: '10px',
                color: '#f8fafc',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-pie-summary">
        <div className="analytics-pie-item">
          <span className="analytics-pie-dot purple" />
          <div>
            <strong>Conversations</strong>
            <p>Saved chat sessions</p>
          </div>
          <b>{conversations.length}</b>
        </div>

        <div className="analytics-pie-item">
          <span className="analytics-pie-dot cyan" />
          <div>
            <strong>PDF Documents</strong>
            <p>Knowledge base files</p>
          </div>
          <b>{documents.length}</b>
        </div>
      </div>
    </div>
  )}
</div>



<div className="analytics-chart-panel">
  <div className="analytics-chart-heading">
    <div>
      <h3>AI Token Usage</h3>
      <p>Actual input and output tokens recorded by Gemini.</p>
    </div>

    <button
      type="button"
      className="refresh-button"
      onClick={fetchTokenAnalytics}
      disabled={analyticsLoading}
    >
      {analyticsLoading ? 'Loading...' : '↻ Refresh tokens'}
    </button>
  </div>

  {analyticsLoading ? (
    <p>Loading token usage...</p>
  ) : analyticsError ? (
    <p role="alert">{analyticsError}</p>
  ) : tokenUsage.input_tokens === 0 &&
    tokenUsage.output_tokens === 0 ? (
    <p className="analytics-chart-empty">
      No token usage recorded yet. Send a message to Gemini first.
    </p>
  ) : (
    <div className="analytics-pie-layout">
      <div className="analytics-pie">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={[
                {
                  name: 'Input Tokens',
                  value: tokenUsage.input_tokens,
                },
                {
                  name: 'Output Tokens',
                  value: tokenUsage.output_tokens,
                },
              ].filter((item) => item.value > 0)}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={100}
              paddingAngle={5}
              stroke="none"
            >
              <Cell fill="#8b5cf6" />
              <Cell fill="#06b6d4" />
            </Pie>
            <Tooltip
              formatter={(value) => [
                Number(value).toLocaleString(),
                'Tokens',
              ]}
              contentStyle={{
                background: '#111a2a',
                border: '1px solid #334155',
                borderRadius: '10px',
                color: '#f8fafc',
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-pie-summary">
        <div className="analytics-pie-item">
          <span className="analytics-pie-dot purple" />
          <div>
            <strong>Input Tokens</strong>
            <p>Sent to Gemini</p>
          </div>
          <b>
            {Number(tokenUsage.input_tokens).toLocaleString()}
          </b>
        </div>

        <div className="analytics-pie-item">
          <span className="analytics-pie-dot cyan" />
          <div>
            <strong>Output Tokens</strong>
            <p>Generated by Gemini</p>
          </div>
          <b>
            {Number(tokenUsage.output_tokens).toLocaleString()}
          </b>
        </div>

        <div className="analytics-pie-item">
          <div>
            <strong>Total Tokens</strong>
            <p>
              {Number(tokenUsage.request_count).toLocaleString()} recorded
              usage entries
            </p>
          </div>
          <b>
            {Number(tokenUsage.total_tokens).toLocaleString()}
          </b>
        </div>
      </div>
    </div>
  )}
</div>


            <div className="analytics-grid">
              <div className="analytics-panel">
                <h3>Recent conversations</h3>
                <p>Your latest saved conversations.</p>

                {historyLoading ? (
                  <p>Loading conversations...</p>
                ) : conversations.length === 0 ? (
                  <p>No saved conversations yet.</p>
                ) : (
                  conversations.slice(0, 5).map((conversation) => (
                    <div
                      className="analytics-list-row"
                      key={conversation.id}
                    >
                      <span>◷</span>
                      <strong>
                        {conversation.title || 'Untitled conversation'}
                      </strong>
                      <button
                        type="button"
                        onClick={() => openConversation(conversation)}
                      >
                        Open
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="analytics-panel">
                <h3>AI capabilities</h3>
                <p>Features currently available in your workspace.</p>

                <div className="analytics-list-row">
                  <span>✳</span>
                  <strong>Gemini AI Assistant</strong>
                  <span className="analytics-status">Available</span>
                </div>

                <div className="analytics-list-row">
                  <span>▤</span>
                  <strong>Document RAG</strong>
                  <span className="analytics-status">Available</span>
                </div>

                <div className="analytics-list-row">
                  <span>⌘</span>
                  <strong>FAISS search index</strong>
                  <span className="analytics-status">Configured</span>
                </div>
              </div>
            </div>

            <p className="analytics-note">
              Conversation counts reflect saved conversations, not total
              messages or AI requests. Response latency, token usage,
              query trends, and agent usage require additional backend
              tracking and are not reported yet.
            </p>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
