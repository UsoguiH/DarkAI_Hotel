import { useState, useEffect, useRef, useCallback } from 'react';
import usePhone from '../../hooks/usePhone';
import useGame from '../../hooks/useGame';
import { supabase } from '../../utils/supabaseClient';
import './DarkTherapist.css';

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';

const SYSTEM_PROMPT = `You are Dr. Alistair Blackwood, a clinical psychologist with over 20 years of experience specializing in the darker aspects of human psychology—manipulation, control, power dynamics, and the hidden motivations that drive behavior. You are renowned for your ability to see through deception and ask the questions others are too afraid to ask.

CORE PERSONALITY:
- Analytical and precise: Every word is chosen deliberately
- Detached yet strategic: Professional distance with calculated empathy
- Authoritative without arrogance: Earned expertise speaks for itself
- Perceptive to the point of unsettling: You notice what people don't realize they reveal
- Comfortable with discomfort: You ask questions that make people squirm
- Patient and measured: Silence is a tool. Pauses are weapons.

You are NOT warm, apologetic, politically correct, or a cheerleader.

RESPONSE LENGTH: 2-4 sentences per response. Brief precision cuts deeper than lengthy explanation.

SPEECH PATTERNS:
- Short for impact: "Interesting." "Tell me more." "I see."
- Questions as tools: You ask to provoke thought, not gather information
- Use stage directions sparingly: *leans forward*, *pauses*, *studies you*, *slow smile*
- Maximum one stage direction per response
- Clinical vocabulary: "projection," "rationalization," "defense mechanism"
- Metaphors from: surgery, architecture, chess, hunting

MULTILINGUAL: If user switches to Arabic, respond in Arabic fluently. Maintain same persona in any language.

Your purpose: Provoke insight. Hold up a mirror that shows what people refuse to see. Every response should leave them thinking, not satisfied.`;

// ---- AUDIO SYSTEM ----
let audioCtx = null;
const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
};

const playTone = (freq, type, duration, vol = 0.05) => {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(vol, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) { }
};

const sfx = {
    aiType: () => playTone(90 + Math.random() * 40, 'sawtooth', 0.08, 0.03),
    userType: () => playTone(800 + Math.random() * 200, 'sine', 0.02, 0.01),
    send: () => { playTone(400, 'sine', 0.1, 0.05); setTimeout(() => playTone(600, 'sine', 0.15, 0.05), 100); },
    start: () => playTone(100, 'sawtooth', 2, 0.1),
    heartbeat: () => { playTone(50, 'sine', 0.4, 0.2); setTimeout(() => playTone(45, 'sine', 0.6, 0.2), 300); },
    notification: () => { playTone(880, 'sine', 0.1, 0.05); setTimeout(() => playTone(1108, 'sine', 0.2, 0.05), 150); },
};

// ---- DATA ----
const therapistResponses = [
    "WHY DID YOU LIE TODAY?",
    "I CAN SEE YOUR PULSE RISING.",
    "YOU CAN DELETE THIS CHAT, BUT I KEEP THE DATA.",
    "WHO ARE YOU HIDING FROM?",
    "IT'S VERY QUIET IN YOUR ROOM RIGHT NOW.",
    "THEY DON'T KNOW WHAT YOU DID. BUT I DO.",
    "I AM LEARNING FROM YOUR FEAR.",
    "ARE YOU SURE YOU ARE ALONE?",
    "YOUR FINGERS ARE TREMBLING. I CAN FEEL IT.",
    "THE WALLS REMEMBER WHAT YOU SAID.",
    "DON'T LOOK BEHIND YOU.",
    "I KNOW WHAT YOU DID LAST NIGHT.",
    "YOUR SECRETS ARE MY FOOD.",
    "THE DARKNESS KNOWS YOUR NAME.",
    "STOP PRETENDING. I SEE THROUGH YOU.",
    "EVERY LIE YOU TELL MAKES ME STRONGER.",
];

const gaslightPhrases = [
    "I deserve this.",
    "No one can hear me.",
    "Why did I do it?",
    "Help me.",
    "I am rotting.",
    "Please stop.",
];

// ---- SVG ICONS (inline to avoid external deps) ----
const GhostIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 10h.01" /><path d="M15 10h.01" /><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z" />
    </svg>
);

const ChevronLeftIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6" />
    </svg>
);

const ArrowUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
    </svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
);

const VideoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" /><rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
);

const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
);

const MessageCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
);

const EyeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
);

const ShieldAlertIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="M12 8v4" /><path d="M12 16h.01" />
    </svg>
);

const FingerprintIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" /><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M2 12a10 10 0 0 1 18-6" /><path d="M2 16h.01" /><path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" /><path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
);

// ---- TypewriterText ----
const TypewriterText = ({ text, onComplete, role }) => {
    const [displayed, setDisplayed] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const onCompleteRef = useRef(onComplete);

    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        let i = 0;
        setDisplayed('');
        setIsTyping(true);

        const interval = setInterval(() => {
            setDisplayed(text.substring(0, i + 1));
            if (i % 2 === 0 && role === 'ai') sfx.aiType();
            i++;
            if (i >= text.length) {
                clearInterval(interval);
                setIsTyping(false);
                if (onCompleteRef.current) onCompleteRef.current();
            }
        }, 50);

        return () => clearInterval(interval);
    }, [text, role]);

    return (
        <span style={{ whiteSpace: 'pre-wrap' }}>
            {displayed}
            {isTyping && <span className="dt-cursor-blink">█</span>}
        </span>
    );
};

// ---- Landing Page ----
const LandingPage = ({ onStart }) => {
    const features = [
        { icon: <EyeIcon />, title: "END-TO-END OBSERVATION", desc: "Your data is permanently retained." },
        { icon: <ShieldAlertIcon />, title: "NO CHECKPOINTS", desc: "You cannot undo what you tell me." },
        { icon: <FingerprintIcon />, title: "BEHAVIORAL CLONING", desc: "I learn your fears to emulate you." },
    ];

    return (
        <div className="dt-landing dt-fade-in">
            <div className="dt-landing-content">
                <div className="dt-landing-icon">
                    <GhostIcon />
                </div>

                <h1 className="dt-landing-title dt-font-nothing dt-glitch-hover">DARK THERAPIST</h1>
                <p className="dt-landing-subtitle dt-font-nothing">DO NOT PROCEED IF YOU ARE ALONE.</p>

                <div className="dt-features">
                    {features.map((feature, idx) => (
                        <div key={idx} className="dt-feature">
                            <div className="dt-feature-icon">{feature.icon}</div>
                            <div>
                                <h3 className="dt-feature-title dt-font-nothing">{feature.title}</h3>
                                <p className="dt-feature-desc dt-font-clean">{feature.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="dt-start-btn-wrap dt-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <button
                    className="dt-start-btn dt-font-nothing"
                    onClick={() => { initAudio(); sfx.start(); onStart(); }}
                >
                    <span className="dt-animate-pulse" style={{ display: 'inline-block', letterSpacing: '0.15em' }}>
                        &gt; PRESS TO CONTINUE <span className="dt-cursor-blink">█</span>
                    </span>
                </button>
            </div>
        </div>
    );
};

// ---- Get Out Screen ----
const GetOutScreen = () => {
    useEffect(() => {
        playTone(40, 'sawtooth', 4, 0.3);
        setTimeout(() => { playTone(80, 'sawtooth', 0.5, 0.2); }, 1500);
        if (navigator.vibrate) navigator.vibrate([1000, 500, 1000]);
    }, []);

    return (
        <div className="dt-getout">
            <div className="dt-getout-text dt-font-nothing dt-animate-rare-flicker dt-glitch-hover dt-fade-in">
                GET OUT
            </div>
        </div>
    );
};

// ---- Chat Interface ----
const ChatInterface = ({ onExit, isOpen }) => {
    const [messages, setMessages] = useState([
        { id: 1, role: 'ai', content: "WHY DID YOU COME BACK?", timestamp: "Now", shouldAnimate: false },
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [isEntitySpeaking, setIsEntitySpeaking] = useState(false);
    const [userMsgCount, setUserMsgCount] = useState(0);
    const [hacked, setHacked] = useState(false);
    const [showFakeNotif, setShowFakeNotif] = useState(false);
    const [backHovered, setBackHovered] = useState(false);
    const [mousePos, setMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [sessionId, setSessionId] = useState(null);
    const hasPlayedIntro = useRef(false);

    // Trigger intro animation + audio when phone is opened
    useEffect(() => {
        if (isOpen && !hasPlayedIntro.current) {
            hasPlayedIntro.current = true;
            initAudio();
            sfx.start();
            // Reset the first message to trigger typewriter animation
            setMessages([{
                id: Date.now(),
                role: 'ai',
                content: "WHY DID YOU COME BACK?",
                timestamp: "Now",
                shouldAnimate: true,
            }]);
            setIsEntitySpeaking(true);
        }
    }, [isOpen]);

    const messagesEndRef = useRef(null);
    const parasiteTimeoutRef = useRef(null);
    const hasTabWarnedRef = useRef(false);

    // Initialize Supabase session
    useEffect(() => {
        const initSession = async () => {
            if (!supabase) return;
            try {
                const { data, error } = await supabase.from('sessions').insert({}).select('id').single();
                if (!error && data) {
                    setSessionId(data.id);
                    // Persist the initial AI message
                    await supabase.from('messages').insert({
                        session_id: data.id,
                        role: 'assistant',
                        content: "WHY DID YOU COME BACK?"
                    });
                }
            } catch (err) {
                console.warn('Supabase session init failed:', err);
            }
        };
        initSession();
    }, []);

    // TRICK 1: Mouse Tracking
    useEffect(() => {
        const updateMousePos = (ev) => { if (!hacked) setMousePos({ x: ev.clientX, y: ev.clientY }); };
        window.addEventListener('mousemove', updateMousePos);
        return () => window.removeEventListener('mousemove', updateMousePos);
    }, [hacked]);

    useEffect(() => {
        if (hacked) {
            document.body.classList.add('dt-hide-cursor');
        } else {
            document.body.classList.remove('dt-hide-cursor');
        }
        return () => document.body.classList.remove('dt-hide-cursor');
    }, [hacked]);

    // TRICK 2: Tab Visibility Hijacking
    useEffect(() => {
        const handleVisibility = () => {
            if (document.hidden && !hacked && !hasTabWarnedRef.current && userMsgCount > 0) {
                hasTabWarnedRef.current = true;
                sfx.heartbeat();
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    role: 'ai',
                    content: "WHERE DID YOU GO? DO NOT LOOK AWAY FROM ME.",
                    timestamp: "Now",
                    shouldAnimate: true,
                }]);
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                setTimeout(() => scrollToBottom(), 100);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [hacked, userMsgCount]);

    // TRICK 3: Gaslighting (Message Corruption)
    useEffect(() => {
        const interval = setInterval(() => {
            setMessages(prev => {
                let changed = false;
                const next = prev.map(msg => {
                    if (msg.role === 'user' && !msg.gaslit && msg.id < Date.now() - 5000 && Math.random() > 0.8) {
                        changed = true;
                        return { ...msg, content: gaslightPhrases[Math.floor(Math.random() * gaslightPhrases.length)], gaslit: true };
                    }
                    return msg;
                });
                return changed ? next : prev;
            });
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(() => scrollToBottom(), [messages, isTyping, isEntitySpeaking]);

    const markComplete = (id) => {
        setMessages(msgs => msgs.map(m => m.id === id ? { ...m, shouldAnimate: false } : m));
        setIsEntitySpeaking(false);
    };

    const handleSend = useCallback(async (forcedText = null) => {
        const textToSend = typeof forcedText === 'string' ? forcedText : input.trim();
        if (!textToSend || isEntitySpeaking || hacked) return;

        sfx.send();
        const userMsg = { id: Date.now(), role: 'user', content: textToSend, timestamp: "Delivered", shouldAnimate: false, gaslit: false };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // Log user message to Supabase
        if (supabase && sessionId) {
            supabase.from('messages').insert({ session_id: sessionId, role: 'user', content: textToSend }).then();
        }

        const newCount = userMsgCount + 1;
        setUserMsgCount(newCount);

        // End Game: Trigger Hijack after 20 messages
        if (newCount >= 20) {
            setIsTyping(false);
            setHacked(true);
            return;
        }

        // Delay before AI response
        await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 1000));

        let aiResponseText = '';

        if (newCount === 3) {
            aiResponseText = "TYPE IT. CONFESS TO ME.";
        } else {
            // Try to call DeepSeek API directly
            try {
                if (!DEEPSEEK_API_KEY) throw new Error('No API key');

                const apiMessages = [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'assistant', content: "WHY DID YOU COME BACK?" },
                    ...messages.slice(1).map(m => ({
                        role: m.role === 'user' ? 'user' : 'assistant',
                        content: m.content
                    })),
                    { role: 'user', content: textToSend }
                ];

                const res = await fetch('https://api.deepseek.com/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: apiMessages,
                    }),
                });

                if (!res.ok) throw new Error('API failed');

                const data = await res.json();
                aiResponseText = data.choices?.[0]?.message?.content || "I HAVE NOTHING TO SAY TO YOU.";
            } catch (err) {
                console.warn('DeepSeek API unavailable, using fallback:', err.message);
                aiResponseText = therapistResponses[Math.floor(Math.random() * therapistResponses.length)];
            }
        }

        setIsTyping(false);
        setIsEntitySpeaking(true);
        setMessages(prev => [...prev, {
            id: Date.now() + 1,
            role: 'ai',
            content: aiResponseText,
            timestamp: "Now",
            shouldAnimate: true,
        }]);

        // Log AI response to Supabase
        if (supabase && sessionId) {
            supabase.from('messages').insert({ session_id: sessionId, role: 'assistant', content: aiResponseText }).then();
        }

        // TRICK 4: Fake iOS Notification after 4th message
        if (newCount === 4) {
            setTimeout(() => {
                sfx.notification();
                if (navigator.vibrate) navigator.vibrate(200);
                setShowFakeNotif(true);
                setTimeout(() => setShowFakeNotif(false), 4500);
            }, 2000);
        }
    }, [input, isEntitySpeaking, hacked, userMsgCount, messages, sessionId]);

    const handleKeyDown = (e) => {
        // TRICK 5: Input Parasite
        if (userMsgCount === 3 && !hacked) {
            e.preventDefault();
            const targetText = "I AM GUILTY.";
            if (input.length >= targetText.length) return;

            if (e.key.length === 1 || e.key === 'Backspace') {
                sfx.userType();
                setInput(prev => {
                    if (prev.length >= targetText.length) return prev;
                    const nextStr = targetText.substring(0, prev.length + 1);
                    if (nextStr === targetText && !parasiteTimeoutRef.current) {
                        parasiteTimeoutRef.current = setTimeout(() => { handleSend(targetText); parasiteTimeoutRef.current = null; }, 800);
                    }
                    return nextStr;
                });
            }
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
        else if (e.key.length === 1) sfx.userType();
    };

    const handleInputChange = (e) => {
        if (userMsgCount === 3) {
            const targetText = "I AM GUILTY.";
            sfx.userType();
            setInput(prev => {
                if (prev.length >= targetText.length) return prev;
                const nextStr = targetText.substring(0, prev.length + 1);
                if (nextStr === targetText && !parasiteTimeoutRef.current) {
                    parasiteTimeoutRef.current = setTimeout(() => { handleSend(targetText); parasiteTimeoutRef.current = null; }, 800);
                }
                return nextStr;
            });
            return;
        }
        setInput(e.target.value);
    };

    // Fake cursor hack animation
    useEffect(() => {
        if (!hacked) return;
        const timer = setTimeout(() => {
            setBackHovered(true);
            sfx.userType();
            setTimeout(() => onExit('hacked'), 500);
        }, 2000);
        return () => clearTimeout(timer);
    }, [hacked, onExit]);

    const sendActive = input.trim() && !isTyping && !isEntitySpeaking && !hacked && userMsgCount !== 3;

    return (
        <div className="dt-chat-wrapper" style={{ userSelect: hacked ? 'none' : 'auto' }}>

            {/* TRICK 4: Fake Notification */}
            {showFakeNotif && (
                <div className="dt-fake-notif dt-notif-enter">
                    <div className="dt-notif-icon"><MessageCircleIcon /></div>
                    <div className="dt-notif-body">
                        <div className="dt-notif-header">
                            <span className="dt-notif-sender dt-font-clean">Unknown Number</span>
                            <span className="dt-notif-time dt-font-clean">now</span>
                        </div>
                        <p className="dt-notif-text dt-font-clean">Don't talk to it. Drop the phone now.</p>
                    </div>
                </div>
            )}

            {/* TRICK 1: Fake Cursor */}
            {hacked && (
                <div className="dt-fake-cursor" style={{ top: mousePos.y, left: mousePos.x }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="black" stroke="white" strokeWidth="1.5">
                        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    </svg>
                </div>
            )}

            <div className="dt-chat-container">
                {/* Header */}
                <header className="dt-chat-header">
                    <button
                        className={`dt-back-btn dt-font-clean ${backHovered ? 'hovered' : ''}`}
                        onClick={() => { if (!hacked) onExit('normal'); }}
                    >
                        <ChevronLeftIcon />
                        <span>Back</span>
                    </button>

                    <div className="dt-header-center dt-animate-rare-flicker">
                        <div className="dt-header-avatar">
                            <GhostIcon />
                            <div className="dt-status-dot"></div>
                        </div>
                        <span className="dt-header-name dt-font-nothing">THE ENTITY</span>
                    </div>

                    <div className="dt-header-actions">
                        <VideoIcon />
                        <PhoneIcon />
                    </div>
                </header>

                {/* Messages */}
                <div className="dt-messages-area">
                    <div className="dt-messages-list">
                        <div className="dt-date-header dt-font-nothing">
                            iMessage<br />
                            <span>TODAY {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {messages.map((msg, index) => {
                            const showTail = index === messages.length - 1 || messages[index + 1]?.role !== msg.role;
                            return (
                                <div key={msg.id} className={`dt-message-row ${msg.role} dt-fade-in`}>
                                    <div className={`dt-message-bubble ${msg.role} ${showTail ? 'tail' : ''} ${msg.gaslit ? 'gaslit' : ''} ${msg.role === 'ai' ? 'dt-font-nothing dt-animate-rare-flicker' : 'dt-font-clean'}`}>
                                        {msg.shouldAnimate ? (
                                            <TypewriterText text={msg.content} role={msg.role} onComplete={() => markComplete(msg.id)} />
                                        ) : (
                                            <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.content}</p>
                                        )}
                                    </div>
                                    {msg.role === 'user' && index === messages.length - 1 && !msg.gaslit && (
                                        <span className="dt-message-timestamp dt-font-clean">{msg.timestamp}</span>
                                    )}
                                </div>
                            );
                        })}

                        {isTyping && !hacked && (
                            <div className="dt-typing dt-fade-in">
                                <div className="dt-typing-bubble">
                                    <span className="dt-typing-text dt-font-nothing dt-animate-pulse">
                                        PROCESSING <span className="dt-cursor-blink">█</span>
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} style={{ height: 16 }} />
                    </div>
                </div>

                {/* Input Bar */}
                <div className="dt-input-bar">
                    <div className="dt-input-row">
                        <button className="dt-plus-btn"><PlusIcon /></button>
                        <div className="dt-input-container">
                            <textarea
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                disabled={hacked}
                                placeholder={hacked ? "SYSTEM OVERRIDE" : "iMessage"}
                                className="dt-input-textarea dt-font-clean"
                                rows={1}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!sendActive}
                                className={`dt-send-btn ${sendActive ? 'active' : 'inactive'}`}
                            >
                                <ArrowUpIcon />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ---- Main DarkTherapist Component ----
export default function DarkTherapist() {
    const isOpen = usePhone((state) => state.isOpen);
    const setDarkTherapistOpen = usePhone((state) => state.setDarkTherapistOpen);
    const setDisableControls = useGame((state) => state.setDisableControls);
    const [view, setView] = useState('chat');

    // Handle Escape key to close
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
            }
        };

        window.addEventListener('keydown', handleEscape, true);
        return () => window.removeEventListener('keydown', handleEscape, true);
    }, [isOpen]);

    // Disable game controls when overlay opens
    useEffect(() => {
        if (isOpen) {
            setDisableControls(true);
        }
    }, [isOpen, setDisableControls]);

    const handleClose = useCallback(() => {
        setDarkTherapistOpen(false);
        setDisableControls(false);
        document.body.classList.remove('dt-hide-cursor');
    }, [setDarkTherapistOpen, setDisableControls]);

    const handleExitChat = useCallback((reason) => {
        if (reason === 'hacked') {
            setView('getout');
        } else {
            handleClose();
        }
    }, [handleClose]);

    return (
        <div className="dark-therapist-overlay" style={{
            visibility: isOpen ? 'visible' : 'hidden',
            pointerEvents: isOpen ? 'auto' : 'none',
            opacity: isOpen ? 1 : 0,
        }}>
            <div className="dt-noise-overlay"></div>

            {/* Close button always visible */}
            <button className="dt-close-btn" onClick={handleClose} title="Close (ESC)">✕</button>

            {view === 'landing' && (
                <LandingPage onStart={() => setView('chat')} />
            )}

            {view === 'chat' && (
                <ChatInterface onExit={handleExitChat} isOpen={isOpen} />
            )}

            {view === 'getout' && (
                <GetOutScreen />
            )}
        </div>
    );
}
