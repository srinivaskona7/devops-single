class SplitPane {
  constructor() {
    this.dragging = null;
    this.startPos = 0;
    this.startSize = 0;
    this.onResize = null;

    this.onMouseMove = this.handleMouseMove.bind(this);
    this.onMouseUp = this.handleMouseUp.bind(this);
  }

  init() {
    const sidebarHandle = document.getElementById('sidebar-handle');
    const terminalHandle = document.getElementById('terminal-handle');

    if (sidebarHandle) {
      sidebarHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.startDrag('sidebar', e.clientX);
        sidebarHandle.classList.add('dragging');
      });
    }

    if (terminalHandle) {
      terminalHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.startDrag('terminal', e.clientY);
        terminalHandle.classList.add('dragging');
      });
    }
  }

  startDrag(type, pos) {
    this.dragging = type;
    this.startPos = pos;

    if (type === 'sidebar') {
      const sidebar = document.getElementById('sidebar');
      this.startSize = sidebar.offsetWidth;
    } else if (type === 'terminal') {
      const panel = document.getElementById('panel-area');
      this.startSize = panel.offsetHeight;
    }

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.body.style.cursor = type === 'sidebar' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  handleMouseMove(e) {
    if (!this.dragging) return;

    if (this.dragging === 'sidebar') {
      const delta = e.clientX - this.startPos;
      const newWidth = Math.max(150, Math.min(600, this.startSize + delta));
      const sidebar = document.getElementById('sidebar');
      sidebar.style.width = newWidth + 'px';
    } else if (this.dragging === 'terminal') {
      const delta = this.startPos - e.clientY;
      const newHeight = Math.max(100, Math.min(window.innerHeight * 0.7, this.startSize + delta));
      const panel = document.getElementById('panel-area');
      panel.style.height = newHeight + 'px';
    }

    if (this.onResize) this.onResize();
  }

  handleMouseUp() {
    document.querySelectorAll('.split-handle-h.dragging, .split-handle-v.dragging').forEach((el) => {
      el.classList.remove('dragging');
    });
    this.dragging = null;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    if (this.onResize) this.onResize();
  }
}

window.SplitPane = SplitPane;
