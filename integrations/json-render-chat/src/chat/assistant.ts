/** Who the assistant is, in one place: the chat shows these, and the server's prompt gives the first two to the model. */

/** Its name, in the title, the composer and each reply. */
export const ASSISTANT = 'Daybook';

/** What it helps with, finishing “You are Daybook, the assistant in …”. */
export const DOMAIN = 'a calendar, inbox and settings app';

/** The prompts an empty chat offers. The mock transport's script answers these. */
export const SUGGESTIONS = ['How’s my week?', 'What’s in my inbox?', 'Show my notification settings', 'Fail once'];
