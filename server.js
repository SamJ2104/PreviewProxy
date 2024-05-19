const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

const rewriteUrls = (html, baseUrl) => {
    const $ = cheerio.load(html);
    const attributes = ['href', 'src'];
  
    $('a, link, script, img, iframe, source').each((_, element) => {
      const $element = $(element);
  
      attributes.forEach((attr) => {
        const url = $element.attr(attr);
        if (url && !url.startsWith('data:') && !url.startsWith('http') && !url.startsWith('//')) {
          const newUrl = new URL(url, baseUrl).href;
          $element.attr(attr, `/proxy?url=${encodeURIComponent(newUrl)}`);
        }
      });
    });
  
    // Remove srcset attribute
    $('img').removeAttr('srcset');
  
    $('form').each((_, element) => {
      const $element = $(element);
      const action = $element.attr('action');
      if (action) {
        const newAction = new URL(action, baseUrl).href;
        $element.attr('action', `/proxy?url=${encodeURIComponent(newAction)}`);
      }
    });
  
    return $.html();
  };

  

app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) {
    return res.status(400).send('URL parameter is required');
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': req.headers['user-agent'], // Forward user agent
        'Referer': url, // Set referer to the original URL
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300 || status === 304,
    });

    const contentType = response.headers['content-type'];

    if (contentType && contentType.includes('text/html')) {
      const html = response.data.toString('utf-8');
      const rewrittenHtml = rewriteUrls(html, url);
      res.set('Content-Type', 'text/html');
      res.send(rewrittenHtml);
    } else {
      res.set('Content-Type', contentType);
      res.send(response.data);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching the URL');
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
});
