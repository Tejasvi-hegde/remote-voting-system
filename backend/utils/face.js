const { spawn } = require('child_process');
const path = require('path');

/**
 * Invokes the Python face helper script to extract a 128-dimensional embedding from a base64 image.
 * Uses stdin to pipe base64 data to bypass OS command length limitations.
 * 
 * @param {string} imageBase64 - The face image in Base64 format (with or without data URL header).
 * @returns {Promise<number[]>} Resolves to a 128-dimensional array of floats.
 */
function extractFaceEmbedding(imageBase64) {
  return new Promise((resolve, reject) => {
    if (!imageBase64) {
      return reject(new Error('No face image provided.'));
    }

    const scriptPath = path.join(__dirname, 'face_helper.py');
    
    // Prioritize virtual environment python executable if it exists
    const fs = require('fs');
    let pythonCmd = 'python';
    const venvWin = path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe');
    const venvUnix = path.join(__dirname, '..', 'venv', 'bin', 'python');
    
    if (fs.existsSync(venvWin)) {
      pythonCmd = venvWin;
    } else if (fs.existsSync(venvUnix)) {
      pythonCmd = venvUnix;
    } else if (process.platform === 'win32') {
      pythonCmd = 'py';
    }

    const pythonProcess = spawn(pythonCmd, [scriptPath]);

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.on('error', (err) => {
      console.error('[Face Process Startup Error]', err);
      reject(new Error(`Failed to start face recognition helper (${pythonCmd}): ${err.message}`));
    });

    pythonProcess.stdin.on('error', (err) => {
      console.error('[Face Process Stdin Error]', err);
    });

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        let errMsg = stderrData.trim() || `Python process exited with code ${code}`;
        try {
          const parsed = JSON.parse(stdoutData.trim());
          if (parsed && parsed.error) errMsg = parsed.error;
        } catch (_) {}
        return reject(new Error(errMsg));
      }

      try {
        const result = JSON.parse(stdoutData.trim());
        if (result.error) {
          return reject(new Error(result.error));
        }
        resolve(result.embedding);
      } catch (err) {
        reject(new Error(`Failed to parse Python helper output: ${stdoutData.trim() || err.message}`));
      }
    });

    // Write base64 image data to stdin of Python process
    try {
      pythonProcess.stdin.write(imageBase64);
      pythonProcess.stdin.end();
    } catch (writeErr) {
      console.error('[Face Process Stdin Write Exception]', writeErr);
      reject(new Error(`Failed to pipe face image to python helper: ${writeErr.message}`));
    }
  });
}

/**
 * Calculates the Euclidean distance between two 128-dimensional face embeddings.
 * 
 * @param {number[]} arr1 - First embedding.
 * @param {number[]} arr2 - Second embedding.
 * @returns {number} The Euclidean distance.
 */
function getEuclideanDistance(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) {
    return Infinity;
  }
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    sum += Math.pow(arr1[i] - arr2[i], 2);
  }
  return Math.sqrt(sum);
}

module.exports = {
  extractFaceEmbedding,
  getEuclideanDistance
};
