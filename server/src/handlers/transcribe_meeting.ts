import { randomUUID } from 'crypto';

export interface TranscribeChunkInput {
  audio_chunk: ArrayBuffer | Uint8Array;
  workspace_id: string;
  session_id?: string;
}

export interface TranscriptionResult {
  partial_transcript: string;
  session_id: string;
  is_final: boolean;
}

// Simple in-memory session storage for demo purposes
// In production, this would be handled by a proper session store (Redis, etc.)
const transcriptionSessions = new Map<string, {
  workspace_id: string;
  accumulated_text: string;
  chunk_count: number;
  created_at: Date;
}>();

export const transcribeMeetingChunk = async (input: TranscribeChunkInput): Promise<TranscriptionResult> => {
  try {
    // Validate input
    if (!input.audio_chunk) {
      throw new Error('Audio chunk is required and cannot be empty');
    }

    const chunkSize = input.audio_chunk instanceof ArrayBuffer 
      ? input.audio_chunk.byteLength 
      : input.audio_chunk.length;

    if (chunkSize === 0) {
      throw new Error('Audio chunk is required and cannot be empty');
    }

    if (!input.workspace_id) {
      throw new Error('Workspace ID is required');
    }

    // Generate or use existing session ID
    const sessionId = input.session_id || randomUUID();

    // Convert audio chunk to consistent format for processing
    const audioData = input.audio_chunk instanceof ArrayBuffer 
      ? new Uint8Array(input.audio_chunk)
      : input.audio_chunk;

    // Get or create session
    let session = transcriptionSessions.get(sessionId);
    if (!session) {
      session = {
        workspace_id: input.workspace_id,
        accumulated_text: '',
        chunk_count: 0,
        created_at: new Date()
      };
      transcriptionSessions.set(sessionId, session);
    }

    // Verify workspace_id matches for existing session
    if (session.workspace_id !== input.workspace_id) {
      throw new Error('Session workspace_id mismatch');
    }

    // Increment chunk counter
    session.chunk_count++;

    // Simulate STT processing based on audio chunk characteristics
    // In production, this would call actual STT service (OpenAI Whisper, etc.)
    const chunkText = await processAudioChunk(audioData, session.chunk_count);
    
    // Accumulate transcription text
    if (chunkText.trim()) {
      session.accumulated_text = session.accumulated_text 
        ? `${session.accumulated_text} ${chunkText}`
        : chunkText;
    }

    // Determine if this is a final result (simulate based on chunk characteristics)
    const isFinal = shouldMarkAsFinal(audioData, session.chunk_count);

    // If final, clean up session after a delay (in production, use proper cleanup)
    if (isFinal) {
      setTimeout(() => {
        transcriptionSessions.delete(sessionId);
      }, 5000); // Clean up after 5 seconds
    }

    return {
      partial_transcript: session.accumulated_text,
      session_id: sessionId,
      is_final: isFinal
    };

  } catch (error) {
    console.error('Meeting transcription failed:', error);
    throw error;
  }
};

// Simulate audio processing - in production, this would call actual STT service
async function processAudioChunk(audioData: Uint8Array, chunkNumber: number): Promise<string> {
  // Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 10));

  // Generate mock transcription based on audio data characteristics
  const dataSize = audioData.length;
  const dataSum = audioData.reduce((sum, byte) => sum + byte, 0);
  const avgValue = dataSum / dataSize;

  // Create deterministic but varied text based on audio characteristics
  if (dataSize < 100) {
    return ''; // Too small, likely silence
  }

  if (avgValue < 50) {
    return chunkNumber === 1 ? 'Hello' : 'and';
  } else if (avgValue < 100) {
    return chunkNumber === 1 ? 'Welcome' : 'everyone';
  } else if (avgValue < 150) {
    return chunkNumber === 1 ? 'Good morning' : 'to the meeting';
  } else {
    return chunkNumber === 1 ? 'Thank you' : 'for joining us today';
  }
}

// Determine if transcription should be marked as final
function shouldMarkAsFinal(audioData: Uint8Array, chunkCount: number): boolean {
  // Mark as final after 5 chunks or if audio suggests end of speech
  if (chunkCount >= 5) {
    return true;
  }

  // Simulate silence detection (all bytes near zero)
  const avgValue = audioData.reduce((sum, byte) => sum + byte, 0) / audioData.length;
  return avgValue < 10; // Very low audio levels suggest silence/end
}