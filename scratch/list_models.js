const https = require('https');

function listModels() {
  const apiKey = process.argv[2];
  if (!apiKey) {
    console.error('Please provide an API key as an argument.');
    return;
  }

  console.log(`Checking models for key starting with: ${apiKey.substring(0, 5)}...`);
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      const json = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log('Available Models:');
        if (json.models) {
          json.models.forEach(m => console.log(` - ${m.name}`));
        } else {
          console.log('No models returned in the response.');
        }
      } else {
        console.error(`API Error (${res.statusCode}):`, JSON.stringify(json, null, 2));
      }
    });
  }).on('error', (err) => {
    console.error('Fetch Error:', err.message);
  });
}

listModels();
