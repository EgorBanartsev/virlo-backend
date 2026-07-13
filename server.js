require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── HEALTH CHECK ──────────────────────────────────
app.get('/', (req, res) => {
  res.json({ status: 'Forge AI Backend Running ⚡', version: '1.0.0' });
});

// ── GENERATE AD SCRIPT ────────────────────────────
app.post('/api/generate-script', async (req, res) => {
  try {
    const {
      productName, productDesc, productBenefits, productPrice,
      audience, tone, platforms, angles, competitor, objection, extra, qty
    } = req.body;

    if (!productName || !productDesc) {
      return res.status(400).json({ error: 'Product name and description required' });
    }

    const platformLabel = platforms?.join(' and ') || 'TikTok and Instagram';
    const angleList = angles?.join(', ') || 'Problem → Solution';

    const prompt = `You are an elite performance marketing strategist specializing in viral short-form video ads for ${platformLabel}.

Create EXACTLY ${qty || 1} complete ad creative package(s) for:

PRODUCT: ${productName}
DESCRIPTION: ${productDesc}
KEY BENEFITS: ${productBenefits || 'Not specified'}
PRICE / OFFER: ${productPrice || 'Not specified'}
TARGET AUDIENCE: ${audience || 'general consumers'}
TONE: ${tone || 'energetic and bold'}
PLATFORM: ${platformLabel}
AD ANGLES: ${angleList}
${competitor ? `COMPETITOR: ${competitor}` : ''}
${objection ? `OBJECTION TO OVERCOME: ${objection}` : ''}
${extra ? `EXTRA CONTEXT: ${extra}` : ''}

ALGORITHM INTELLIGENCE:
- TikTok 2025: Hook must land in 1.7 seconds. Saves and shares outweigh likes. Videos 24-31 seconds perform best. Niche community content beats broad viral attempts.
- Instagram Reels: Hook in 2 seconds. Story arc keeps watch time. Relatable UGC outperforms polished ads.
- Design for SAVES (tip content), SHARES (relatable pain), and COMMENTS (ask questions).

Return ONLY a valid JSON array. No markdown, no backticks, no explanation.

Each element MUST follow this exact schema:
{
  "angle": "specific angle used",
  "viral_score": <integer 70-99>,
  "viral_breakdown": {
    "hook_strength": <integer 0-100>,
    "share_potential": <integer 0-100>,
    "save_potential": <integer 0-100>,
    "comment_bait": <integer 0-100>
  },
  "signals": ["signal 1", "signal 2", "signal 3"],
  "hook": "scroll-stopping opener max 10 words",
  "script": "full 20-30 second spoken script with [ACTION: description] cues and ... for pauses",
  "ugc_script": "20-25 second UGC customer testimonial. First person. Natural imperfect speech. Starts with pain, transitions to product, ends with result. Include [pause] and [action] cues.",
  "storyboard": [
    {"time":"0-2s","visual":"what viewer sees","copy":"hook line"},
    {"time":"2-7s","visual":"what viewer sees","copy":"spoken line"},
    {"time":"7-15s","visual":"what viewer sees","copy":"spoken line"},
    {"time":"15-22s","visual":"what viewer sees","copy":"spoken line"},
    {"time":"22-30s","visual":"CTA moment","copy":"closing line + CTA"}
  ],
  "caption": "2-3 sentence platform-native caption ending with a question",
  "hashtags": "12-15 hashtags as single string",
  "ctas": ["Primary CTA", "Secondary CTA", "Urgency CTA"],
  "ab_variants": [
    {"label":"Hook B","text":"alternative hook"},
    {"label":"Hook C","text":"alternative hook"},
    {"label":"Caption B","text":"alternative caption"},
    {"label":"CTA B","text":"comment-trigger CTA"}
  ],
  "posting_strategy": {
    "best_time": "best time to post e.g. 7PM Tuesday",
    "platform_first": "TikTok or Instagram - which to post first and why",
    "caption_tip": "specific tip for this ad's caption",
    "engagement_hook": "what to say in first comment to boost engagement"
  },
  "competitor_notes": "what competitors are doing in this space and how this ad differentiates"
}`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );

    const raw = response.data.content?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const ads = JSON.parse(clean);

    res.json({ success: true, ads: Array.isArray(ads) ? ads : [ads] });

  } catch (err) {
    console.error('Script generation error:', err.message);
    res.status(500).json({ error: err.message || 'Script generation failed' });
  }
});

// ── GENERATE UGC VIDEO (HEDRA) ────────────────────
app.post('/api/generate-ugc-video', async (req, res) => {
  try {
    const { script, avatarImageUrl, voiceId } = req.body;

    if (!script) return res.status(400).json({ error: 'Script required' });

    // Step 1: Generate audio from script text using Hedra TTS
    const audioResponse = await axios.post(
      'https://mercury.dev.dream-ai.com/api/v1/audio',
      {
        text: script,
        voice_id: voiceId || 'default'
      },
      {
        headers: {
          'X-API-KEY': process.env.HEDRA_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    // Convert audio to base64
    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    // Step 2: Upload audio to Hedra
    const audioUpload = await axios.post(
      'https://mercury.dev.dream-ai.com/api/v1/audio/upload',
      { audio: audioDataUrl },
      {
        headers: {
          'X-API-KEY': process.env.HEDRA_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const audioUrl = audioUpload.data.url;

    // Step 3: Generate talking head video
    const videoResponse = await axios.post(
      'https://mercury.dev.dream-ai.com/api/v1/characters',
      {
        text: script,
        voice_url: audioUrl,
        avatar_image: avatarImageUrl || null,
        aspect_ratio: '9:16'
      },
      {
        headers: {
          'X-API-KEY': process.env.HEDRA_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const jobId = videoResponse.data.job_id || videoResponse.data.id;

    res.json({ success: true, jobId, status: 'processing', provider: 'hedra' });

  } catch (err) {
    console.error('UGC video error:', err.response?.data || err.message);
    res.status(500).json({ error: 'UGC video generation failed: ' + (err.response?.data?.message || err.message) });
  }
});

// ── GENERATE PRODUCT VIDEO (KLING) ───────────────
app.post('/api/generate-product-video', async (req, res) => {
  try {
    const { prompt, imageUrl, duration } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    const payload = {
      model: 'kling-v1',
      prompt: prompt,
      negative_prompt: 'blurry, low quality, watermark, text overlay',
      duration: duration || 5,
      aspect_ratio: '9:16',
      mode: 'std'
    };

    if (imageUrl) {
      payload.image_url = imageUrl;
    }

    const response = await axios.post(
      'https://api.klingai.com/v1/videos/text2video',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.KLING_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const jobId = response.data?.data?.task_id || response.data?.task_id;

    res.json({ success: true, jobId, status: 'processing', provider: 'kling' });

  } catch (err) {
    console.error('Product video error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Product video generation failed: ' + (err.response?.data?.message || err.message) });
  }
});

// ── CHECK VIDEO STATUS (HEDRA) ────────────────────
app.get('/api/video-status/hedra/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const response = await axios.get(
      `https://mercury.dev.dream-ai.com/api/v1/characters/${jobId}`,
      {
        headers: { 'X-API-KEY': process.env.HEDRA_API_KEY }
      }
    );

    const data = response.data;
    const status = data.status || data.job_status;
    const videoUrl = data.video_url || data.result_url || null;

    res.json({
      success: true,
      status: status === 'completed' || status === 'done' ? 'completed' : 'processing',
      videoUrl,
      provider: 'hedra'
    });

  } catch (err) {
    console.error('Hedra status error:', err.message);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// ── CHECK VIDEO STATUS (KLING) ────────────────────
app.get('/api/video-status/kling/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const response = await axios.get(
      `https://api.klingai.com/v1/videos/text2video/${jobId}`,
      {
        headers: { 'Authorization': `Bearer ${process.env.KLING_API_KEY}` }
      }
    );

    const data = response.data?.data || response.data;
    const status = data?.task_status;
    const videoUrl = data?.task_result?.videos?.[0]?.url || null;

    res.json({
      success: true,
      status: status === 'succeed' ? 'completed' : status === 'failed' ? 'failed' : 'processing',
      videoUrl,
      provider: 'kling'
    });

  } catch (err) {
    console.error('Kling status error:', err.message);
    res.status(500).json({ error: 'Status check failed' });
  }
});

// ── GET HEDRA AVATARS ─────────────────────────────
app.get('/api/avatars', async (req, res) => {
  try {
    const response = await axios.get(
      'https://mercury.dev.dream-ai.com/api/v1/avatars',
      { headers: { 'X-API-KEY': process.env.HEDRA_API_KEY } }
    );
    res.json({ success: true, avatars: response.data });
  } catch (err) {
    console.error('Avatars error:', err.message);
    res.status(500).json({ error: 'Failed to fetch avatars' });
  }
});

// ── SAVE PROJECT (SUPABASE) ───────────────────────
app.post('/api/save-project', async (req, res) => {
  try {
    const { userId, productName, ads, videos } = req.body;
    const { data, error } = await supabase
      .from('projects')
      .insert({
        id: uuidv4(),
        user_id: userId || 'default',
        product_name: productName,
        ads: ads,
        videos: videos,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    res.json({ success: true, project: data[0] });
  } catch (err) {
    console.error('Save error:', err.message);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// ── GET PROJECTS (SUPABASE) ───────────────────────
app.get('/api/projects/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId || 'default')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, projects: data });
  } catch (err) {
    console.error('Get projects error:', err.message);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚡ Forge AI Backend running on port ${PORT}`);
});
