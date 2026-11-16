// The checks every Eurth tool runs: contrast, security headers, privacy, launch secrecy, pages
// and the launch date. They read the built site, so run "npm run build" first (CI does).
import { standardSuites } from '@eurth/style/testing';
import { site } from '../eurth.config.mjs';
import { TONE_PAIRS } from '../src/tool/theme';

// Time pairs tokens in a way of its own: the words on a span are the surface colour on one of
// the suite's text colours. Each pair is held to the 7:1 of body text, in both themes.
standardSuites({ site, pairs: TONE_PAIRS });
