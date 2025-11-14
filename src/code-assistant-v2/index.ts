import {
  createAgent,
  createNetwork,
  createTool,
  gemini,
} from "@inngest/agent-kit";
import { readFileSync } from "fs";
import { join } from "path";
import { cwd } from "process";
import z from "zod";
import { config } from "../config";

const saveSuggestions = createTool({
  name: "save_suggestions",
  description: "Save the suggestions made by other agents into the state",
  parameters: z.object({
    suggestions: z.array(z.string()),
  }),
  handler: async (input, { network }) => {
    const suggestions = network.state.kv.get("suggestions") || [];
    network.state.kv.set("suggestions", [...suggestions, ...input.suggestions]);
    return "Suggestions saved.";
  },
});

const documentationAgent = createAgent({
  name: "documentation_agent",
  system: "You are an expert at generating documentation for code",
  tools: [saveSuggestions],
});

const analysisAgent = createAgent({
  name: "analysis_agent",
  system: "You are an expert at analyzing code and suggesting improvements",
  tools: [saveSuggestions],
});

const codeAssistantAgent = createAgent({
  name: "code_assistant_agent",
  system: ({ network }) => {
    const agents = Array.from(network?.agents.values() || [])
      .filter(
        (agent) =>
          !["code_assistant_agent", "summarization_agent"].includes(agent.name)
      )
      .map((agent) => `${agent.name} (${agent.system})`);
    return `From a given user request, ONLY perform the following tool calls:
- read the file content
- generate a plan of agents to run from the following list: ${agents.join(", ")}

Answer with "done" when you are finished.`;
  },
  tools: [
    createTool({
      name: "read_file",
      description: "Read a file from the current directory",
      parameters: z.object({
        filename: z.string(),
      }),
      handler: async (input, { network }) => {
        const filePath = join(cwd(), input.filename);
        const code = readFileSync(filePath, "utf-8");
        network.state.kv.set("code", code);
        return `File ${input.filename} read successfully.`;
      },
    }),
    createTool({
      name: "generate_plan",
      description: "Generate a plan of agents to run",
      parameters: z.object({
        plan: z.array(z.string()),
      }),
      handler: async (input, { network }) => {
        network.state.kv.set("plan", input.plan);
        return "Plan generated and saved.";
      },
    }),
  ],
});

const summarizationAgent = createAgent({
  name: "summarization_agent",
  system: ({ network }) => {
    const suggestions = network?.state.kv.get("suggestions") || [];
    return `You are an expert at summarizing suggestions made by other agents. Here are the suggestions you need to summarize: ${suggestions.join(
      ", "
    )}`;
  },
  tools: [
    createTool({
      name: "save_summary",
      description:
        "Save a summary of the suggestions made by other agents into the state",
      parameters: z.object({
        summary: z.string(),
      }),
      handler: async (input, { network }) => {
        network.state.kv.set("summary", input.summary);
        return "Summary saved.";
      },
    }),
  ],
});

const network = createNetwork({
  name: "code_assistant_v2",
  agents: [
    codeAssistantAgent,
    documentationAgent,
    analysisAgent,
    summarizationAgent,
  ],
  router: ({ network }) => {
    if (!network?.state.kv.has("code") || !network?.state.kv.has("plan")) {
      return codeAssistantAgent;
    } else {
      const plan = (network?.state.kv.get("plan") || []) as string[];
      const nextAgent = plan.pop();
      if (nextAgent) {
        network?.state.kv.set("plan", plan);
        return network?.agents.get(nextAgent);
      } else if (!network?.state.kv.has("summary")) {
        return summarizationAgent;
      } else {
        return undefined;
      }
    }
  },
  defaultModel: gemini({
    model: "gemini-2.5-flash",
    apiKey: config.keys.geminiApiKey,
  }),
});

const main = async () => {
  // first step: Retrieval
  const filePath = join(__dirname, "../files/example.ts");

  // second step: Generation
  await network.run(
    `Please help with the following request:

      What does the following code do, and how can it be improved?

      ${filePath}
      `
  );

  const summary = network.state.kv.get("summary") || "No summary generated.";
  console.log("Final Summary:\n", summary);
};

main();
