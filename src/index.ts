import { createAgent, gemini } from "@inngest/agent-kit";
import { readFileSync } from "fs";
import { join } from "path";
import { config } from "./config";

const codeAssistant = createAgent({
  name: "code_assistant",
  system:
    "An AI assistant that helps answer questions about code by reading and analyzing files",
  model: gemini({
    model: "gemini-2.5-flash",
    apiKey: config.keys.geminiApiKey as string,
  }),
});

const main = async () => {
  // first step: Retrieval
  const filePath = join(__dirname, "../files/example.ts");
  const code = readFileSync(filePath, "utf-8");

  // second step: Generation
  const { output } = await codeAssistant.run(`What the following code does?

      ${code}
      `);

  const lastMessage = output[output.length - 1];
  const response =
    lastMessage?.type === "text" ? (lastMessage.content as string) : "";
  console.log(response);
};

main();
