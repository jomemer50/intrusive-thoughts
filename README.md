# Intrusive Thoughts

A deeply interactive, locally-persistent AI chat application built with Next.js App Router, designed for confronting your intrusive thoughts and deep, edgy philosophical introspection. The app uses an advanced local-first architecture to provide a seamless, private, and beautifully animated user experience.

## Features

- **Offline-First Chat History**: Completely private architecture. No databases and no authentication required. All chat histories, including multi-conversation support, are stored securely in your browser's local storage.
- **Interactive Canvas UI**: The home screen features a physics-based, interactive HTML5 canvas. The background mimics a lined notebook, and your cursor acts as a pen leaving a dynamic ink trail that fades over time.
- **Smart Theme Engine**: Fully integrated with Tailwind CSS v4 and `next-themes`. The app natively supports both Light and Dark modes, seamlessly inverting canvas ink colors and component themes.
- **Cloud LLM Integration**: Powered by `nvidia/nemotron-3-ultra-550b-a55b` via OpenRouter. Uses LangChain (`@ai-sdk/langchain`) to stream philosophical, deep-thinking responses directly to the client.
- **Modern Tech Stack**: Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion, and Lucide React.

## Getting Started

First, make sure you have your OpenRouter API key. Create a `.env.local` file in the root directory and add your key:

```bash
OPENROUTER_API_KEY=your_api_key_here
```

Then, install the dependencies and run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. You'll be greeted by the interactive notebook UI before entering the chat interface.

## Architecture Notes

- The chat interface is heavily reliant on client-side state (`useChat` from `@ai-sdk/react`) to manage conversations without database latency.

## License

This project is open-sourced under the [MIT License](LICENSE).
