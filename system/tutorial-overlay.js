/* Tutorial overlay for first greenlight flow */
class TutorialOverlay {
  constructor() {
    this.steps = [
      { target: '#btnStart', title: 'Launch Studio', desc: 'Start your first studio career' },
      { target: '[data-tab="develop"]', title: 'Develop Tab', desc: 'Buy scripts and greenlight films here' },
      { target: '#btnWeek', title: 'Advance Week', desc: 'Progress time and watch your studio grow' }
    ];
    this.index = 0;
  }
  
  show() {
    if (!G.tutorial || G.tutorial.completed) return;
    const step = this.steps[this.index];
    // Simple implementation - creates overlay
    const overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 5000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    overlay.innerHTML = `
      <div style="background: var(--surface-2); border:1px solid var(--line-1); border-radius: var(--r-lg); padding: var(--space-6); max-width: 400px;">
        <h3 style="margin:0 0 var(--space-3) 0;">${step.title}</h3>
        <p style="margin:0 0 var(--space-4) 0; color: var(--text-2);">${step.desc}</p>
        <button class="ui-btn ui-btn--primary" onclick="this.parentElement.parentElement.remove()">Next</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }
}

// Initialize on first game start
if (typeof window !== 'undefined') {
  window.TutorialOverlay = TutorialOverlay;
}
