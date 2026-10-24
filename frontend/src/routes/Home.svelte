<main class="home">
  <p class="name">Baghban</p>
  <h1>Garden</h1>
  <nav>
    <a href="/planner">Planner</a>
    <a href="/calendar">Calendar</a>
  </nav>
</main>

<style>
  .home {
    min-height: 100vh;
    box-sizing: border-box;
    padding: 48px 24px;
    font-family: Roboto, sans-serif;
    color: #191d17;
    background: #f0f4f0;
  }

  .name {
    margin: 0 0 8px;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #386a20;
  }

  h1 {
    margin: 0 0 24px;
    font-size: 2rem;
    font-weight: 500;
  }

  nav {
    display: flex;
    gap: 12px;
  }

  a {
    display: inline-block;
    padding: 10px 16px;
    border-radius: 8px;
    background: #386a20;
    color: #ffffff;
    font-weight: 500;
    text-decoration: none;
  }

  a:hover {
    background: #2d5619;
  }
</style>
