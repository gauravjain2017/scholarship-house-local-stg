const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../../../logs');
const LOG_FILE = path.join(LOG_DIR, 'app.log');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const write = (level, message, data) => {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] [${level}] ${message}`;

  if (data !== undefined) {
    if (data instanceof Error) {
      line += `\n  Message : ${data.message}`;
      line += `\n  Stack   : ${data.stack}`;
      if (data.$metadata)  line += `\n  AWS Meta: ${JSON.stringify(data.$metadata)}`;
      if (data.Code)       line += `\n  AWS Code: ${data.Code}`;
      if (data.name)       line += `\n  Name    : ${data.name}`;
    } else {
      line += `\n  Value   : ${JSON.stringify(data, null, 2)}`;
    }
  }

  line += '\n----------------------------------------\n';

  fs.appendFileSync(LOG_FILE, line, 'utf8');
};

const logger = {
  info:  (message, data) => { console.log(message, data ?? '');   write('INFO',  message, data); },
  error: (message, data) => { console.error(message, data ?? ''); write('ERROR', message, data); },
  warn:  (message, data) => { console.warn(message, data ?? '');  write('WARN',  message, data); },
  debug: (message, data) => { console.log(message, data ?? '');   write('DEBUG', message, data); },
};

module.exports = logger;
