/**
 * Preset blocked (abusive) words — English, Hindi (Devanagari) and Hinglish (Roman Hindi).
 * A trailing * also blocks every ending of the word (fuck* → fucking, fucker). Entries with a space
 * are phrases. Admins can add or allow words in Website settings → Moderation.
 */

export const ENGLISH_WORDS: readonly string[] = ["fuck*", "motherfuck*", "fuk", "fukk*", "fck", "fcuk*", "phuck*", "stfu", "shit", "shits", "shitty", "shitting", "shithead*", "shitshow", "bullshit*", "horseshit", "bitch*", "sonofabitch", "son of a bitch", "bastard*", "asshole*", "arsehole*", "ass", "arse", "dumbass*", "jackass*", "smartass*", "dickhead*", "cunt*", "twat*", "wanker*", "slut*", "whore*", "skank*", "pussy", "cock", "cocksuck*", "blowjob*", "jerkoff", "jerk off", "bollocks", "piss off", "pissoff", "retard", "retards", "retarded", "nigger", "niggers", "nigga", "niggas", "faggot*"];

export const HINDI_WORDS: readonly string[] = ["चूतिया", "चुतिया", "चूतिये", "चुतिये", "चूतियापा", "चूत", "चुत", "भेनचोद", "बहनचोद", "बहिनचोद", "भैनचोद", "बेहेनचोद", "मादरचोद", "मादरचोत", "भोसड़ी", "भोसड़ीके", "भोसड़ीवाले", "भोसड़ा", "भोसड़े", "गांड", "गाँड", "गांडू", "गाँडू", "गांडु", "लौड़ा", "लौड़े", "लोड़ू", "लंड", "लण्ड", "रंडी", "रण्डी", "रंडवा", "हरामी", "हरामखोर", "हरामज़ादा", "हरामज़ादे", "हरामज़ादी", "कुतिया", "कमीना", "कमीने", "कमीनी", "झांट", "झाँट", "झांटू", "झाँटू", "भड़वा", "भड़वे", "भड़वी", "चोदू", "चुदाई", "चोदना"];

export const HINGLISH_WORDS: readonly string[] = ["chutiya*", "chutia*", "chootiya*", "chutiye", "chootiye", "chut", "choot", "bhenchod*", "behenchod*", "bahenchod*", "bhanchod*", "benchod*", "behnchod*", "bhencho", "behencho", "madarchod*", "maderchod*", "madharchod*", "maadarchod*", "madarjaat", "bhosdike", "bhosadike", "bhosdika", "bhosdiwala", "bhosdiwale", "bhosda", "bhosde", "bhosdi", "bhosadi", "bhosri", "bsdk", "gaand*", "gand", "gandu", "gaandu", "lund", "lauda", "laude ke", "lawda", "lavda", "lavde", "lawde", "lodu", "loda", "randi", "randiya", "randiyon", "randwa", "randibaaz*", "harami", "haramkhor", "haramzada", "haramzade", "haramzadi", "haraamzaada", "kutiya", "kutte ki aulaad", "kamina", "kameena", "kamine", "kaminey", "jhaant*", "jhant", "jhantu", "jhaatu", "jhatu", "bhadwa", "bhadwe", "bhadve", "bhadva", "bhadwi", "chodu", "chudai", "chudakkad*", "bakchod*", "mkc", "bkl", "tmkc"];

export const PRESET_BLOCKED_WORDS: readonly string[] = [...ENGLISH_WORDS, ...HINDI_WORDS, ...HINGLISH_WORDS];
