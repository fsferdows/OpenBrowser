import { createServer } from 'node:http';

const MOCK_PAGES = {
  '/catalog.html': `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Mock Product Catalog</title></head>
<body>
  <main>
    <h1>Product Catalog</h1>
    <form id="search-form" onsubmit="event.preventDefault(); filterItems();">
      <label for="search-box">Search Products</label>
      <input type="search" id="search-box" name="q" placeholder="Type query...">
      <button type="submit" id="search-btn">Search</button>
    </form>
    <table role="table" aria-label="Products Table">
      <thead><tr><th>Name</th><th>Price</th></tr></thead>
      <tbody id="product-rows">
        <tr><td>MacBook Pro</td><td>$1999</td></tr>
        <tr><td>Noise-Canceling Headphones</td><td>$299</td></tr>
        <tr><td>Mechanical Keyboard</td><td>$129</td></tr>
      </tbody>
    </table>
    <div id="search-result-count" aria-live="polite">3 items listed</div>
  </main>
  <script>
    function filterItems() {
      const q = document.getElementById('search-box').value.toLowerCase();
      const rows = document.querySelectorAll('#product-rows tr');
      let count = 0;
      rows.forEach(r => {
        const text = r.children[0].textContent.toLowerCase();
        const matches = text.includes(q);
        r.style.display = matches ? '' : 'none';
        if (matches) count++;
      });
      document.getElementById('search-result-count').textContent = count + ' items listed';
    }
  </script>
</body>
</html>`,

  '/form.html': `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Mock Registration Form</title></head>
<body>
  <main>
    <h1>User Registration</h1>
    <form id="reg-form" onsubmit="event.preventDefault(); submitForm();">
      <div>
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required>
      </div>
      <div>
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div>
        <label for="role-select">Account Role</label>
        <select id="role-select" name="role">
          <option value="developer">Developer</option>
          <option value="manager">Manager</option>
        </select>
      </div>
      <div>
        <label><input type="checkbox" id="terms" name="terms" required> Agree to Terms</label>
      </div>
      <button type="submit" id="submit-btn">Create Account</button>
    </form>
    <div id="status-message" aria-live="polite"></div>
  </main>
  <script>
    function submitForm() {
      document.getElementById('status-message').textContent = 'Account created successfully for ' + document.getElementById('username').value;
    }
  </script>
</body>
</html>`,

  '/auth-hand-off.html': `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Mock Security Hand-Off</title></head>
<body>
  <main>
    <h1>Secure Area</h1>
    <div id="captcha-box" role="alert" aria-live="assertive">
      <h2>Security Challenge Required</h2>
      <p>Solve the puzzle below to continue.</p>
      <button id="verify-human-btn" onclick="document.getElementById('captcha-box').style.display='none'; document.getElementById('protected-content').style.display='block';">I am human</button>
    </div>
    <div id="protected-content" style="display: none;">
      <h2>Welcome to Protected Dashboard</h2>
      <p id="secret-data">Authenticated Session Active</p>
    </div>
  </main>
</body>
</html>`
};

export function startTestServer(port = 0) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const page = MOCK_PAGES[url.pathname];

      if (page) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(page);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const serverUrl = `http://127.0.0.1:${addr.port}`;
      resolve({
        server,
        url: serverUrl,
        stop: () => new Promise(res => server.close(res))
      });
    });

    server.on('error', reject);
  });
}
