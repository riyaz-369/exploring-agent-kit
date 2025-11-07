/* eslint-disable */
import { anthropic, createAgent } from "@inngest/agent-kit";
import { readFileSync } from "fs";
import { join } from "path";

const codeAssistant = createAgent({
  name: "code_assistant",
  system:
    "An AI assistant that helps answer questions about code by reading and analyzing files",
  model: anthropic({
    model: "claude-3-5-sonnet-latest",
    defaultParameters: {
      max_tokens: 1000,
    },
    apiKey:
      "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",
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
  const content =
    lastMessage?.type === "text" ? (lastMessage.content as string) : "";
  console.log("Assistant response:", content);
};

main();
