import {defineElement} from '@tecton-astryx/core/define.js';
import {TctAvatar} from './tct-avatar.js';
import {TctAvatarGroup} from './tct-avatar-group.js';
import {TctAvatarGroupOverflow} from './tct-avatar-group-overflow.js';
import {TctAvatarStatusDot} from './tct-avatar-status-dot.js';

// Providers first (the group provides to avatars, avatars to status dots); upgrade order is not
// relied on, because consumers re-request when a provider announces itself.
defineElement(TctAvatarGroup);
defineElement(TctAvatar);
defineElement(TctAvatarStatusDot);
defineElement(TctAvatarGroupOverflow);

export {TctAvatar, TctAvatarGroup, TctAvatarGroupOverflow, TctAvatarStatusDot};
