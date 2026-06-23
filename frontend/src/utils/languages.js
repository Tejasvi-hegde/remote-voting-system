import React, { createContext, useContext, useState } from 'react';

const translations = {
  en: {
    // AuthScreen
    welcome: 'Welcome, Voter!',
    enter_fp: 'Please enter your Simulated Fingerprint ID.',
    fp_placeholder: 'Enter Fingerprint ID (e.g. 15)',
    btn_scan: 'Simulate Hardware Fingerprint Scan',
    btn_scanning: 'Scanning...',
    err_fp: 'Please enter a Simulated Fingerprint ID first.',
    identity_verified: 'Identity Verified (Simulated Fingerprint)',
    voter_name: 'Name',
    voter_id: 'Voter ID',
    constituency: 'Constituency',
    session_valid: 'Session Valid Until',
    loading_ballot: 'Loading your ballot in {secs} seconds...',
    btn_proceed: 'Proceed to Ballot Now →',
    eci: 'Election Commission of India',
    terminal_title: 'Secure Voting Terminal',
    
    // BallotScreen
    official_ballot: 'Official Ballot',
    ballot_instruction: 'Select ONE candidate and press Confirm Vote.',
    nota_title: 'None of the Above (NOTA)',
    nota_desc: 'Article 49-O',
    btn_confirm_selection: 'Confirm Selection →',
    select_hint: 'Please select a candidate to continue.',
    loading_ballot_spinner: 'Loading your constituency ballot...',

    // ConfirmScreen
    final_confirmation: '⚠️ Final Confirmation',
    about_to_cast: 'You are about to cast your vote for:',
    warning_undo: 'This action cannot be undone. Once submitted, your vote is permanently recorded on the blockchain.',
    btn_go_back: '← Go Back',
    btn_cast_vote: '✅ Cast My Vote',
    submitting_vote: 'Submitting your vote...',
    do_not_touch: 'Please do not touch the screen or leave the terminal.',
    confirm_wait: 'This may take a few seconds while the blockchain confirms.',
    vote_cast_success: 'Vote Cast Successfully!',
    vote_cast_desc: 'Your vote was successfully casted for {candidate}. It has been securely recorded on the blockchain.',
    tx_label: 'Transaction ID (keep this for verification)',
    recorded_at: 'Recorded at: {time}',
    thank_you: '🙏 Thank you for exercising your democratic right. This terminal will reset in a moment.',
    reset_notice: 'Terminal resets in {secs} seconds...',
  },
  hi: {
    // AuthScreen
    welcome: 'स्वागत है, मतदाता!',
    enter_fp: 'कृपया अपनी सिम्युलेटेड फिंगरप्रिंट आईडी दर्ज करें।',
    fp_placeholder: 'फिंगरप्रिंट आईडी दर्ज करें (जैसे 15)',
    btn_scan: 'हार्डवेयर फिंगरप्रिंट स्कैन सिम्युलेट करें',
    btn_scanning: 'स्कैनिंग हो रही है...',
    err_fp: 'कृपया पहले सिम्युलेटेड फिंगरप्रिंट आईडी दर्ज करें।',
    identity_verified: 'पहचान सत्यापित (सिम्युलेटेड फिंगरप्रिंट)',
    voter_name: 'नाम',
    voter_id: 'मतदाता पहचान पत्र (Voter ID)',
    constituency: 'निर्वाचन क्षेत्र',
    session_valid: 'सत्र समाप्ति समय',
    loading_ballot: '{secs} सेकंड में आपका मतपत्र लोड हो रहा है...',
    btn_proceed: 'अब मतपत्र पर जाएँ →',
    eci: 'भारत निर्वाचन आयोग',
    terminal_title: 'सुरक्षित मतदान टर्मिनल',

    // BallotScreen
    official_ballot: 'आधिकारिक मतपत्र',
    ballot_instruction: 'किसी एक उम्मीदवार का चयन करें और मत की पुष्टि करें।',
    nota_title: 'इनमें से कोई नहीं (नोटा)',
    nota_desc: 'धारा 49-ओ',
    btn_confirm_selection: 'चयन की पुष्टि करें →',
    select_hint: 'आगे बढ़ने के लिए कृपया एक उम्मीदवार का चयन करें।',
    loading_ballot_spinner: 'आपके निर्वाचन क्षेत्र का मतपत्र लोड हो रहा है...',

    // ConfirmScreen
    final_confirmation: '⚠️ अंतिम पुष्टि',
    about_to_cast: 'आप अपना वोट निम्नलिखित उम्मीदवार को देने जा रहे हैं:',
    warning_undo: 'यह कार्रवाई वापस नहीं ली जा सकती। एक बार सबमिट करने के बाद, आपका वोट स्थायी रूप से ब्लॉकचेन पर दर्ज हो जाता है।',
    btn_go_back: '← वापस जाएँ',
    btn_cast_vote: '✅ अपना वोट डालें',
    submitting_vote: 'आपका वोट सबमिट किया जा रहा है...',
    do_not_touch: 'कृपया स्क्रीन को न छुएं और टर्मिनल न छोड़ें।',
    confirm_wait: 'ब्लॉकचेन पुष्टि होने में कुछ सेकंड लग सकते हैं।',
    vote_cast_success: 'वोट सफलतापूर्वक डाला गया!',
    vote_cast_desc: 'आपका वोट {candidate} के लिए सफलतापूर्वक दर्ज किया गया। इसे ब्लॉकचेन पर सुरक्षित रूप से सहेज लिया गया है।',
    tx_label: 'लेनदेन आईडी (सत्यापन के लिए इसे सुरक्षित रखें)',
    recorded_at: 'दर्ज किया गया समय: {time}',
    thank_you: '🙏 अपने लोकतांत्रिक अधिकार का प्रयोग करने के लिए धन्यवाद। यह टर्मिनल कुछ ही पलों में रीसेट हो जाएगा।',
    reset_notice: 'टर्मिनल {secs} सेकंड में रीसेट हो जाएगा...',
  },
  kn: {
    // AuthScreen
    welcome: 'ಸ್ವಾಗತ, ಮತದಾರರೇ!',
    enter_fp: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸಿಮ್ಯುಲೇಟೆಡ್ ಫಿಂಗರ್‌ಪ್ರಿಂಟ್ ಐಡಿ ನಮೂದಿಸಿ.',
    fp_placeholder: 'ಫಿಂಗರ್‌ಪ್ರಿಂಟ್ ಐಡಿ ನಮೂದಿಸಿ (ಉದಾ. 15)',
    btn_scan: 'ಹಾರ್ಡ್‌ವೇರ್ ಫಿಂಗರ್‌ಪ್ರಿಂಟ್ ಸ್ಕ್ಯಾನ್ ಸಿಮ್ಯುಲೇಟ್ ಮಾಡಿ',
    btn_scanning: 'ಸ್ಕ್ಯಾನ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    err_fp: 'ದಯವಿಟ್ಟು ಮೊದಲು ಸಿಮ್ಯುಲೇಟೆಡ್ ಫಿಂಗರ್‌ಪ್ರಿಂಟ್ ಐಡಿ ನಮೂದಿಸಿ.',
    identity_verified: 'ಗುರುತು ದೃಢೀಕರಿಸಲ್ಪಟ್ಟಿದೆ (ಸಿಮ್ಯುಲೇಟೆಡ್ ಫಿಂಗರ್‌ಪ್ರಿಂಟ್)',
    voter_name: 'ಹೆಸರು',
    voter_id: 'ಮತದಾರರ ಚೀಟಿ (Voter ID)',
    constituency: 'ಮತಕ್ಷೇತ್ರ',
    session_valid: 'ಅಧಿವೇಶನದ ಮಾನ್ಯತೆ',
    loading_ballot: '{secs} ಸೆಕೆಂಡುಗಳಲ್ಲಿ ನಿಮ್ಮ ಮತಪತ್ರವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    btn_proceed: 'ಮತಪತ್ರಕ್ಕೆ ಮುಂದುವರಿಯಿರಿ →',
    eci: 'ಭಾರತೀಯ ಚುನಾವಣಾ ಆಯೋಗ',
    terminal_title: 'ಸುರಕ್ಷಿತ ಮತದಾನ ಟರ್ಮಿನಲ್',

    // BallotScreen
    official_ballot: 'ಅಧಿಕೃತ ಮತಪತ್ರ',
    ballot_instruction: 'ಒಬ್ಬ ಅಭ್ಯರ್ಥಿಯನ್ನು ಆಯ್ಕೆ ಮಾಡಿ ಮತ್ತು ಮತವನ್ನು ದೃಢೀಕರಿಸಿ.',
    nota_title: 'ಮೇಲಿನ ಯಾರೂ ಅಲ್ಲ (NOTA)',
    nota_desc: 'ಕಲಂ 49-ಒ',
    btn_confirm_selection: 'ಆಯ್ಕೆಯನ್ನು ದೃಢೀಕರಿಸಿ →',
    select_hint: 'ಮುಂದುವರಿಯಲು ದಯವಿಟ್ಟು ಒಬ್ಬ ಅಭ್ಯರ್ಥಿಯನ್ನು ಆಯ್ಕೆಮಾಡಿ.',
    loading_ballot_spinner: 'ನಿಮ್ಮ ಮತಕ್ಷೇತ್ರದ ಮತಪತ್ರವನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',

    // ConfirmScreen
    final_confirmation: '⚠️ ಅಂತಿಮ ದೃಢೀಕರಣ',
    about_to_cast: 'ನೀವು ನಿಮ್ಮ ಮತವನ್ನು ಈ ಕೆಳಗಿನ ಅಭ್ಯರ್ಥಿಗೆ ಚಲಾಯಿಸಲು ಹೊರಟಿದ್ದೀರಿ:',
    warning_undo: 'ಈ ಕ್ರಿಯೆಯನ್ನು ಹಿಂತಿರುಗಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ಒಮ್ಮೆ ಸಲ್ಲಿಕೆಯಾದ ನಂತರ, ನಿಮ್ಮ ಮತವನ್ನು ಬ್ಲಾಕ್‌ಚೈನ್‌ನಲ್ಲಿ ಶಾಶ್ವತವಾಗಿ ದಾಖಲಿಸಲಾಗುತ್ತದೆ.',
    btn_go_back: '← ಹಿಂದೆ ಹೋಗಿ',
    btn_cast_vote: '✅ ನನ್ನ ಮತ ಚಲಾಯಿಸು',
    submitting_vote: 'ನಿಮ್ಮ ಮತವನ್ನು ಸಲ್ಲಿಸಲಾಗುತ್ತಿದೆ...',
    do_not_touch: 'ದಯವಿಟ್ಟು ಸ್ಕ್ರೀನ್ ಮುಟ್ಟಬೇಡಿ ಅಥವಾ ಟರ್ಮಿನಲ್ ಬಿಟ್ಟು ಹೋಗಬೇಡಿ.',
    confirm_wait: 'ಬ್ಲಾಕ್‌ಚೈನ್ ದೃಢೀಕರಿಸುವವರೆಗೆ ಕೆಲವು ಸೆಕೆಂಡುಗಳು ಬೇಕಾಗಬಹುದು.',
    vote_cast_success: 'ಮತ ಯಶಸ್ವಿಯಾಗಿ ಚಲಾಯಿಸಲಾಗಿದೆ!',
    vote_cast_desc: 'ನಿಮ್ಮ ಮತವನ್ನು {candidate} ಗೆ ಯಶಸ್ವಿಯಾಗಿ ಚಲಾಯಿಸಲಾಗಿದೆ. ಇದನ್ನು ಬ್ಲಾಕ್‌ಚೈನ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿ ದಾಖಲಿಸಲಾಗಿದೆ.',
    tx_label: 'ವಹಿವಾಟು ಐಡಿ (ಪರಿಶೀಲನೆಗಾಗಿ ಇದನ್ನು ಇಟ್ಟುಕೊಳ್ಳಿ)',
    recorded_at: 'ದಾಖಲಾದ ಸಮಯ: {time}',
    thank_you: '🙏 ನಿಮ್ಮ ಪ್ರಜಾಪ್ರಭುತ್ವದ ಹಕ್ಕನ್ನು ಚಲಾಯಿಸಿದ್ದಕ್ಕಾಗಿ ಧನ್ಯವಾದಗಳು. ಈ ಟರ್ಮಿನಲ್ ಕೆಲವೇ ಕ್ಷಣಗಳಲ್ಲಿ ಮರುಹೊಂದಿಸಲ್ಪಡುತ್ತದೆ.',
    reset_notice: 'ಟರ್ಮಿನಲ್ {secs} ಸೆಕೆಂಡುಗಳಲ್ಲಿ ಮರುಹೊಂದಿಸಲ್ಪಡುತ್ತದೆ...',
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('voting_lang') || 'en');

  const t = (key, replacements = {}) => {
    let str = translations[lang]?.[key] || translations['en']?.[key] || key;
    Object.keys(replacements).forEach((k) => {
      str = str.replace(`{${k}}`, replacements[k]);
    });
    return str;
  };

  const changeLanguage = (newLang) => {
    setLang(newLang);
    localStorage.setItem('voting_lang', newLang);
  };

  return (
    <LanguageContext.Provider value={{ lang, t, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
