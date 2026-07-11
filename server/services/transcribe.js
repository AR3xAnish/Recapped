/**
 * Audio Transcription Service
 * Transcribes audio files via Groq's Whisper-large-v3 model API.
 */

function chunkWav(fileBuffer, maxChunkSize) {
  const header = fileBuffer.subarray(0, 44);
  const data = fileBuffer.subarray(44);
  const chunks = [];
  let offset = 0;

  while (offset < data.length) {
    const chunkData = data.subarray(offset, offset + maxChunkSize);
    offset += maxChunkSize;

    const chunkBuffer = Buffer.alloc(44 + chunkData.length);
    header.copy(chunkBuffer, 0);
    chunkData.copy(chunkBuffer, 44);

    // Update ChunkSize in header
    chunkBuffer.writeUInt32LE(chunkBuffer.length - 8, 4);
    // Update Subchunk2Size in header
    chunkBuffer.writeUInt32LE(chunkData.length, 40);

    chunks.push(chunkBuffer);
  }
  return chunks;
}

function chunkMp3(fileBuffer, maxChunkSize) {
  const chunks = [];
  let start = 0;

  while (start < fileBuffer.length) {
    let end = start + maxChunkSize;
    if (end >= fileBuffer.length) {
      chunks.push(fileBuffer.subarray(start));
      break;
    }

    // Find the next frame sync word near 'end' to avoid splitting a frame
    let syncPos = end;
    while (syncPos > start && syncPos > end - 4096) {
      if (fileBuffer[syncPos] === 0xff && (fileBuffer[syncPos + 1] & 0xe0) === 0xe0) {
        break;
      }
      syncPos--;
    }

    if (syncPos <= start || syncPos <= end - 4096) {
      syncPos = end;
      while (syncPos < fileBuffer.length && syncPos < end + 4096) {
        if (fileBuffer[syncPos] === 0xff && (fileBuffer[syncPos + 1] & 0xe0) === 0xe0) {
          break;
        }
        syncPos++;
      }
    }

    if (syncPos >= fileBuffer.length || syncPos <= start) {
      syncPos = end;
    }

    chunks.push(fileBuffer.subarray(start, syncPos));
    start = syncPos;
  }
  return chunks;
}

function chunkGeneric(fileBuffer, maxChunkSize) {
  const chunks = [];
  let offset = 0;
  while (offset < fileBuffer.length) {
    chunks.push(fileBuffer.subarray(offset, offset + maxChunkSize));
    offset += maxChunkSize;
  }
  return chunks;
}

function chunkAudio(fileBuffer, filename, maxChunkSize = 20 * 1024 * 1024) {
  const ext = filename.split(".").pop().toLowerCase();
  if (ext === "wav") {
    return chunkWav(fileBuffer, maxChunkSize);
  } else if (ext === "mp3") {
    return chunkMp3(fileBuffer, maxChunkSize);
  }
  return chunkGeneric(fileBuffer, maxChunkSize);
}

async function transcribeSegment(segmentBuffer, filename, mimeType) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is not configured on the server.");
  }

  const formData = new FormData();
  const blob = new Blob([segmentBuffer], { type: mimeType });
  formData.append("file", blob, filename);
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "json");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API transcription segment failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  return result.text || "";
}

async function transcribeAudio(fileBuffer, filename, mimeType) {
  // Groq Whisper API limit is 25MB. We chunk at 20MB to be safe.
  const MAX_SIZE = 20 * 1024 * 1024;

  if (fileBuffer.length <= MAX_SIZE) {
    return await transcribeSegment(fileBuffer, filename, mimeType);
  }

  console.log(`[Transcribe] File size ${fileBuffer.length} exceeds 20MB limit. Splitting into chunks...`);
  const segments = chunkAudio(fileBuffer, filename, MAX_SIZE);
  console.log(`[Transcribe] Split into ${segments.length} segment(s). Transcribing in sequence...`);

  let fullText = "";
  for (let i = 0; i < segments.length; i++) {
    console.log(`[Transcribe] Transcribing segment ${i + 1} of ${segments.length}...`);
    const segmentText = await transcribeSegment(segments[i], `part_${i}_${filename}`, mimeType);
    if (fullText) fullText += " ";
    fullText += segmentText.trim();
  }

  return fullText;
}

module.exports = {
  transcribeAudio,
};
