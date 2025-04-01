import { glob } from "glob";
import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { fileURLToPath } from "url";

// Get current file path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..", "pages");

// Pages to exclude from the index
const excludedPages = [
  "400.mdx",
  "500.mdx",
  "index.mdx",
  "404.mdx",
  "_app.tsx",
  "_document.tsx",
  "_meta.json", // ?
];

function toTitleCase(str) {
  return str
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function processFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const { data: frontMatter, content: markdownContent } = matter(content);
    const relativePath = path.relative(rootDir, filePath);
    const depth = relativePath.split(path.sep).length - 1;
    const fileName = path.basename(filePath, path.extname(filePath));
    const fileTitle = frontMatter.title || toTitleCase(fileName);

    // Create heading based on depth
    const heading = "#".repeat(Math.min(depth + 1, 6));

    return {
      title: fileTitle,
      content: markdownContent.trim(),
      heading: `${heading} ${fileTitle}`,
      path: relativePath,
      frontMatter,
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return null;
  }
}

async function generateIndex() {
  try {
    // Locate all MDX/MD files
    const files = await glob("pages/**/*.{md,mdx}");

    // Filter out excluded files
    const validFiles = files.filter(
      (file) =>
        !excludedPages.includes(path.basename(file)) &&
        !path.basename(file).startsWith("_")
    );

    // Sort files by path to maintain hierarchy
    validFiles.sort();

    let output = "# Master index\n\n";
    output += "> This is the master index of the Optimism Docs.\n\n";
    output += "## Table of contents\n\n";

    // Process it all
    const processedFiles = await Promise.all(
      validFiles.map((file) => processFile(file))
    );

    // Generate TOC
    processedFiles.forEach((file) => {
      if (file) {
        const indent = "  ".repeat(file.path.split("/").length - 1);
        output += `${indent}- [${file.title}](#${file.title
          .toLowerCase()
          .replace(/\s+/g, "-")})\n`;
      }
    });

    output += "\n---\n\n";
    processedFiles.forEach((file) => {
      if (file) {
        output += `\n${file.heading}\n\n`;

        if (file.frontMatter.description) {
          // metadata if available
          output += `> ${file.frontMatter.description}\n\n`;
        }

        // Add file path reference
        output += `*source: \`${file.path}\`*\n\n`;
        output += `${file.content}\n\n`;
        output += "---\n\n";
      }
    });

    // Write the combined content to a file
    const outputPath = path.join(process.cwd(), "docs-index.md");
    await fs.writeFile(outputPath, output);
    console.log(`✅ generated index: ${outputPath}`);
  } catch (error) {
    console.error("❌ Error :", error);
    process.exit(1);
  }
}

generateIndex();
