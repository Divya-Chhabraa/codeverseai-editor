const ACTIONS = {
    JOIN: 'join',
    JOINED: 'joined',
    DISCONNECTED: 'disconnected',

    CODE_CHANGE: 'code-change',
    SYNC_CODE: 'sync-code',
    SYNC_CODE_REQUEST: 'sync-code-request',

    LEAVE: 'leave',

    LANGUAGE_CHANGE: 'language-change',

    RUN_START: 'run-start',
    RUN_INPUT: 'run-input',
    RUN_STOP: 'run-stop',
    RUN_OUTPUT: 'run-output',

    INPUT_CHANGE: 'input-change',

    CHAT_MESSAGE: 'chat-message',
    CHAT_HISTORY: 'chat-history',

    AI_MESSAGE: 'ai-message',
    AI_HISTORY_REQUEST: 'ai-history-request',
    AI_HISTORY_SYNC: 'ai-history-sync',
    AI_DOC_REQUEST: 'ai-doc-request',
    AI_DOC_RESULT: 'ai-doc-result',

    VIDEO_JOIN: 'video-join',
    VIDEO_PLAY: 'video-play',
    VIDEO_PAUSE: 'video-pause',
    VIDEO_SEEK: 'video-seek',
    VIDEO_CHANGE: 'video-change',
    VIDEO_STATE_SYNC: 'video-state-sync',
    VIDEO_SYNC_REQUEST: 'video-sync-request',
};

module.exports = ACTIONS;
