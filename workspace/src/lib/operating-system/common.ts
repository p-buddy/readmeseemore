export type Status = (status: string) => void;

export const cli = {
  flags: {
    npx: {
      yesToAll: "-y",
    },
    chokidar: {
      ignore: "-i",
    }
  },
  input: {
    prompt: {
      default: "\u001b[1G\u001b[0J\u001b[35m❯\u001b[39m \u001b[3G",
      error: "\u001b[1G\u001b[0J\u001b[31m❯\u001b[39m \u001b[3G",
      prefix: "❯ "
    },
    user: {
      return: "\r",
    },
    eol: String.fromCharCode(5),
    backspace: "\b",
  },
  output: {
    location: "~/workspace"
  }
} as const;