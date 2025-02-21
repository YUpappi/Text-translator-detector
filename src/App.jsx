import { useState, useEffect, useRef } from "react";

const options = {
  sharedContext: "This is a scientific article",
  type: "key-points",
  format: "markdown",
  length: "medium",
};
const TextProcessor = () => {
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState([]);
  const [targetLang, setTargetLang] = useState("en");
  const summarizerRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [detectedLang, setDetectedLang] = useState(null);
  const [translateDisabled, setTranslateDisabled] = useState(false);
  const [translation, setTranslation] = useState({});
  // Initialize to null

  const languages = {
    en: { name: "English", flagCode: "gb" },
    fr: { name: "French", flagCode: "fr" },
    es: { name: "Spanish", flagCode: "es" },
    pt: { name: "Portuguese", flagCode: "pt" },
    ru: { name: "Russian", flagCode: "ru" },
    tr: { name: "Turkish", flagCode: "tr" },
  };

  useEffect(() => {
    setTranslateDisabled(detectedLang === targetLang);
  }, [detectedLang, targetLang]);

  useEffect(() => {
    async function initSummarizer() {
      try {
        const available = await self.ai.summarizer.capabilities();
        if (available.available !== "no") {
          summarizerRef.current = await self.ai.summarizer.create(options);
        }
      } catch (error) {
        console.error("Summarizer initialization failed", error);
      }
    }
    initSummarizer();
  }, []); // Empty dependency array ensures this runs only once on mount

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return; // Don't send empty messages

    const newMessage = {
      text: text,
      sender: "user", // Mark as user message
      language: null,
      summary: null,
      translation: null,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputText(""); // Clear the input field

    try {
      const detected = await handleDetectedLang(text);
      newMessage.language = detected;
      setDetectedLang(detected); // Update the detected language

      if (text.length >= 150 && detected === "en" && summarizerRef.current) {
        // Check if summarizer is available
        const summaryResult = await handleSummarizer(text);
        newMessage.summary = summaryResult;
      }

      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = newMessage;
        return updatedMessages;
      });
    } catch (error) {
      console.error("Error processing text:", error);
      newMessage.error = "Error processing text.";
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[updatedMessages.length - 1] = newMessage;
        return updatedMessages;
      });
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDetectedLang = async (text) => {
    try {
      const languageDetectorCapabilities =
        await self.ai.languageDetector.capabilities();
      const canDetect = languageDetectorCapabilities.capabilities;
      let detector;

      if (canDetect === "readily") {
        detector = await self.ai.languageDetector.create();
      } else {
        detector = await self.ai.languageDetector.create({
          monitor(m) {
            m.addEventListener("downloadprogress", (e) => {
              console.log(`Downloaded ${e.loaded} of ${e.total} bytes.`);
            });
          },
        });
        await detector.ready;
      }

      const results = await detector.detect(text);
      return results[0]?.detectedLanguage || "en";
    } catch (error) {
      console.error("Error in detecting language", error);
      return "en"; // Default to English if detection fails
    }
  };

  const handleSummarizer = async (text) => {
    try {
      setIsLoading(true);
      if (!summarizerRef.current) return;

      const summaryResult = await summarizerRef.current.summarize(text);
      console.log("Summary API response", summaryResult);
      if (typeof summaryResult === "string") {
        return summaryResult;
      } else if (summaryResult[0] && summaryResult[0].text) {
        return summaryResult[0].text;
      } else if (summaryResult.summary) {
        return summaryResult.summary;
      }
      return "no summary available";
    } catch (err) {
      console.error("Summarization failed", err);
      return "Summarization failed."; // Return an error message
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslate = async (userInput) => {
    try {
      if (translateDisabled) return;
      setIsLoading(true);
      const handleTransLator = await self.ai.translator.create({
        sourceLanguage: detectedLang || "en", // Use detected language or default to 'en'
        targetLanguage: targetLang,
      });
      const translatedText = await handleTransLator.translate(userInput);
      return translatedText;
    } catch (error) {
      console.error("Error in translation", error);
      return "Translation failed.";
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateButtonClick = async (message, index) => {
    if (translation[index]) return;
    try {
      const translated = await handleTranslate(message.text);
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[index].translation = translated;
        return updatedMessages;
      });
      setTranslation((prev) => ({ ...prev, [index]: true }));
    } catch (err) {
      console.error("Error in translation", err);
      message.translation = "Translation failed.";
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        updatedMessages[index] = message;
        return updatedMessages;
      });
    }
  };

  return (
    <div className="chatbot">
      <header>
        <h1 className="lang-options">Translator and Lang Detector</h1>
      </header>
      <ul className="chatbox">
        {messages.map((message, index) => (
          <div key={index}>
            {/*  */}
            {/*  */}
            <li className="chat outgoing">
              <div className="chat-input-text">
                <p className="message-user">{message.text}</p>

                {message.language && (
                  <p className="message-language">
                    <img
                      src={`https://flagcdn.com/w40/${
                        languages[message.language]?.flagCode
                      }.png`}
                      alt={message.language}
                      width="20"
                      height="15"
                    />{" "}
                    {languages[message.language]?.name || message.language}
                  </p>
                )}
                <div className="message-subject">
                  <select
                    id="languageSelect"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    className=""
                  >
                    {Object.entries(languages).map(([code, { name }]) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleTranslateButtonClick(message, index)}
                    disabled={
                      translateDisabled || isLoading || translation[index]
                    }
                    className="translate-btn"
                  >
                    {isLoading
                      ? "Translating..."
                      : translation[index]
                      ? "Translated"
                      : "Translate"}
                  </button>
                </div>

                {/*  */}

                {message.text.length >= 150 &&
                  message.language === "en" &&
                  !message.summary && (
                    <button
                      onClick={() => handleSummarizer(message.text, index)}
                      disabled={isLoading}
                      className="translate-btn "
                    >
                      {isLoading ? "Summarizing..." : "Summarize"}
                    </button>
                  )}
                <span className="time">{message.timestamp}</span>
              </div>
            </li>

            <li className="chat incoming">
              {message.translation && (
                <p>
                  {message.translation}

                  {message.translation && (
                    <span className="time">{message.timestamp}</span>
                  )}
                </p>
              )}
              {message.summary && (
                <p className="message-summary">
                  {message.summary}

                  {message.summary && (
                    <span className="time">{message.timestamp}</span>
                  )}
                </p>
              )}

              {message.error && (
                <p className="message-error">
                  {message.error}

                  {message.error && (
                    <span className="time">{message.timestamp}</span>
                  )}
                </p>
              )}
            </li>
          </div>
        ))}
      </ul>

      <div className="chat-input">
        <textarea
          value={inputText}
          onKeyDown={handleKeyDown}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Enter your text here..."
          aria-label="Enter your text here"
        />
        <span>
          {inputText.length > 0 && (
            <button
              onClick={handleSend}
              className="send-btn"
              aria-label="Send message"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="15"
                // viewBox="0 0 20 20"
                fill="#3cb371"
              >
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          )}
        </span>
      </div>
    </div>
  );
};

export default TextProcessor;
