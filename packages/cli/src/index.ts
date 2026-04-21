#!/usr/bin/env node
import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';
import { buildCommand } from './commands/build/index.js';
import { buildListCommand } from './commands/build/list.js';
import { buildViewCommand } from './commands/build/view.js';
import { buildDownloadCommand } from './commands/build/download.js';
import { buildCancelCommand } from './commands/build/cancel.js';
import { submitCommand } from './commands/submit/index.js';
import { submitListCommand } from './commands/submit/list.js';
import { submitViewCommand } from './commands/submit/view.js';
import { credentialsAddCommand } from './commands/credentials/add.js';
import { credentialsListCommand } from './commands/credentials/list.js';
import { credentialsRemoveCommand } from './commands/credentials/remove.js';
import { orgCreateCommand } from './commands/org/create.js';
import { orgMembersCommand } from './commands/org/members.js';
import { orgInviteCommand } from './commands/org/invite.js';
import { orgSwitchCommand } from './commands/org/switch.js';

const program = new Command();

program
  .name('forge')
  .description('Forge Build Service — EAS-compatible build platform')
  .version('0.1.0');

// Auth
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);

// Build
program.addCommand(buildCommand);
program.addCommand(buildListCommand);
program.addCommand(buildViewCommand);
program.addCommand(buildDownloadCommand);
program.addCommand(buildCancelCommand);

// Submit
program.addCommand(submitCommand);
program.addCommand(submitListCommand);
program.addCommand(submitViewCommand);

// Credentials
const creds = new Command('credentials').description('Manage signing credentials');
creds.addCommand(credentialsAddCommand);
creds.addCommand(credentialsListCommand);
creds.addCommand(credentialsRemoveCommand);
program.addCommand(creds);

// Org
const org = new Command('org').description('Manage organizations');
org.addCommand(orgCreateCommand);
org.addCommand(orgMembersCommand);
org.addCommand(orgInviteCommand);
org.addCommand(orgSwitchCommand);
program.addCommand(org);

program.parse();
