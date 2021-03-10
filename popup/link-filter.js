const reportError = (error) => {
  document.querySelector('#popup-content').classList.add('hidden');
  const errorEl = document.querySelector('#error-content');
  errorEl.innerText = error;
  errorEl.classList.remove('hidden');
}

const createLinkEl = (link, onClick, parent) => {
  const a = document.createElement('a');
  a.setAttribute('href', link.href);
  a.addEventListener('click', onClick);
  a.appendChild(document.createTextNode(link.text));

  const li = document.createElement('li');
  li.appendChild(a);
  parent.appendChild(li);
}

const _getLinks = (tab) => (callback) => {
  browser.tabs.sendMessage(tab.id, {command: 'getlinks'})
    .then(callback)
    .catch(reportError);
}

const _setUrl = (tab) => (url, callback, newTab) => {
  if (newTab) {
    browser.tabs.create({active: false, url})
      .then(() => {})
      .catch(reportError);
  }
  else {
    browser.tabs.update(tab.id, {url})
      .then(callback)
      .catch(reportError);
  }
}

const _onLinkClick = (tab, navigate) => (e) => {
  e.preventDefault();
  navigate(e.target.href, window.close, e.ctrlKey || e.metaKey);
}

const _writeToClipboard = (text) => {
  navigator.clipboard.writeText(text).then(
    () => {},
    () => {
      reportError('Copy failed');
    });
}

const render = (links, onLinkClick) => {
  const results = document.getElementById('results');
  while (results.firstChild) {
    results.removeChild(results.firstChild);
  }

  const tools = document.getElementById('tools');

  if (links.length > 0) {
    tools.classList.remove('hidden')
    links.forEach((link) => createLinkEl(link, onLinkClick, results));
  } else {
    tools.classList.add('hidden')
    results.innerHTML = '<p>No links</p>'
  }
}

const filter = (filter, links) => {
  if (!filter || !filter.length) {
    filter = '.*';
  }
  const re = new RegExp(filter, 'gi');
  return !!re ?
    links.filter(((link) => {
      const linktext = link.text;
      return re.test(linktext);
    })) : links;
}

const _update = (links, onLinkClick) => () => {
  const filterInput = document.getElementById('input-filter');
  chrome.storage.local.set({'filter': filterInput.value});
  const filtered = filter(filterInput.value, links);
  render(filtered, onLinkClick);
}

const init = ([tab]) => {
  const getLinks = _getLinks(tab);
  const setUrl = _setUrl(tab);
  const onLinkClick = _onLinkClick(tab, setUrl);
  let update;
  let filterTimeout;

  const filterInput = document.getElementById('input-filter');
  filterInput.addEventListener('input', () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(update, 100);
  });

  const copyUrlsButton = document.getElementById('copy-urls-button');
  copyUrlsButton.addEventListener('click', () => {
    links = Array.from(document.links)
      .map((link) => link.href)
      .join('\n');
    _writeToClipboard(links);
  });

  const copyHtmlButton = document.getElementById('copy-html-button');
  copyHtmlButton.addEventListener('click', () => {
    links = Array.from(document.links)
      .map((link) => `<a href='${link.href}'>${link.text.trim()}</a>`)
      .join('\n');
    _writeToClipboard(links);
  });

  getLinks(({links}) => {
    update = _update(links, onLinkClick);
    update();
  });

  // Restore the contents of the input from last
  // time we were open

  chrome.storage.local.get('filter', function(result) {
    filterInput.value = result.filter || '';
  });
}

browser
  .tabs
  .executeScript({file: '/content_scripts/link-filter.js'})
  .then(() => {
    browser
      .tabs
      .query({currentWindow: true, active: true})
      .then(init)
      .catch(reportError);
  })
  .catch(reportError);
