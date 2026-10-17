/* Ludo Royale: complete playable browser game.
   Rules: 4 tokens/player, six to leave yard, 52-space shared loop, 6-cell home lane,
   exact finish, captures, safe squares, bonus turn for six/capture/finish, three sixes cancel.
   Red vs 3 bots by default; local mode supports hot-seat play. */
(() => {
  "use strict";
  const COLORS = ["red", "green", "yellow", "blue"];
  const LABEL = { red:"Red", green:"Green", yellow:"Yellow", blue:"Blue" };
  const HEX = { red:"#ff5964", green:"#39d98a", yellow:"#ffc94a", blue:"#55a4ff" };
  const START = { red:0, green:13, yellow:26, blue:39 };
  const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  const TRACK = makeTrack();
  const HOME_LANES = {
    red: [[6,1],[6,2],[6,3],[6,4],[6,5],[6,6]],
    green: [[1,8],[2,8],[3,8],[4,8],[5,8],[6,8]],
    yellow: [[8,13],[8,12],[8,11],[8,10],[8,9],[8,8]],
    blue: [[13,6],[12,6],[11,6],[10,6],[9,6],[8,6]]
  };
  const YARDS = {
    red:[[2.8,2.8],[4.2,2.8],[2.8,4.2],[4.2,4.2]],
    green:[[2.8,10.8],[4.2,10.8],[2.8,12.2],[4.2,12.2]],
    yellow:[[10.8,10.8],[12.2,10.8],[10.8,12.2],[12.2,12.2]],
    blue:[[10.8,2.8],[12.2,2.8],[10.8,4.2],[12.2,4.2]]
  };
  const $ = id => document.getElementById(id);
  const svg = $("ludoBoard"), tokenLayer = $("boardTokens");
  let game, botTimer = null, toastTimer = null, soundOn = true;
  let audioCtx = null;

  function makeTrack() {
    // 52 cells in a continuous square loop around a classic cross-shaped board.
    const a = [];
    // upper-left approach, across the top-left arm
    for (let c=1;c<=5;c++) a.push([6,c]);
    for (let r=5;r>=0;r--) a.push([r,6]);
    a.push([0,7]);
    for (let r=0;r<=5;r++) a.push([r,8]);
    for (let c=9;c<=14;c++) a.push([6,c]);
    a.push([7,14]);
    for (let c=14;c>=9;c--) a.push([8,c]);
    for (let r=9;r<=14;r++) a.push([r,8]);
    a.push([14,7]);
    for (let r=14;r>=9;r--) a.push([r,6]);
    for (let c=5;c>=0;c--) a.push([8,c]);
    a.push([7,0]);
    a.push([7,1]); // final connector closes the 52-space loop
    return a.slice(0,52);
  }
  function initGame() {
    clearTimeout(botTimer);
    game = {
      turn:0, dice:null, waiting:false, winner:null, consecutiveSixes:0,
      mode:$("mode").value, difficulty:$("difficulty").value, lastRoll:0,
      players:Object.fromEntries(COLORS.map(c=>[c,{tokens:[-1,-1,-1,-1]}]))
    };
    $("diceFace").textContent="—";
    $("notice").textContent=game.mode==="bots" ? "You are Red. Roll the dice to begin." : "Local mode: pass the device after each turn.";
    $("modalBackdrop").classList.add("hidden");
    renderAll();
  }
  function sound(freq=520,duration=.07) {
    if(!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.type="sine"; osc.frequency.value=freq; gain.gain.value=.045;
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start();
      gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      osc.stop(audioCtx.currentTime+duration);
    } catch(_) {}
  }
  function showToast(msg) {
    const el=$("toast"); el.textContent=msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),1900);
  }
  function gridCenter([r,c]) { return {x:(c+.5)*700/15, y:(r+.5)*700/15}; }
  function cellRect(r,c,fill,stroke="#e5dfcf",sw=1,rx=0) {
    return `<rect x="${c*700/15}" y="${r*700/15}" width="${700/15}" height="${700/15}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" rx="${rx}"/>`;
  }
  function circle(x,y,r,fill,stroke="none",sw=0) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  }
  function drawBoard() {
    let out = `<rect width="700" height="700" fill="#f7f1df"/>`;
    // four yards
    const zones=[
      {c:"red",x:0,y:0},{c:"green",x:9,y:0},{c:"yellow",x:9,y:9},{c:"blue",x:0,y:9}
    ];
    zones.forEach(z=>{
      out += `<rect x="${z.x*700/15}" y="${z.y*700/15}" width="${6*700/15}" height="${6*700/15}" fill="${HEX[z.c]}" stroke="#fff8e9" stroke-width="3"/>`;
      out += `<rect x="${(z.x+1)*700/15}" y="${(z.y+1)*700/15}" width="${4*700/15}" height="${4*700/15}" rx="18" fill="#fffaf0"/>`;
      YARDS[z.c].forEach(([r,c])=>{
        const p=gridCenter([r,c]); out += circle(p.x,p.y,19,HEX[z.c],"#fff",4);
      });
    });
    // shared track cells
    TRACK.forEach((coord,i)=>{
      const [r,c]=coord;
      let fill="#fffdf6";
      const color=Object.keys(START).find(k=>START[k]===i);
      if(color) fill=HEX[color];
      if(SAFE.has(i) && !color) fill="#e8e3d6";
      out += cellRect(r,c,fill,"#d7d0bf",1.4,3);
      const p=gridCenter(coord);
      if(SAFE.has(i)) out += `<text x="${p.x}" y="${p.y+8}" text-anchor="middle" font-size="20" fill="${color? "#fff":"#8c8a7e"}">★</text>`;
      if(color) out += `<path d="M ${p.x-8} ${p.y-7} l 16 0 l -8 15 z" fill="#ffffffaa"/>`;
    });
    // home lanes
    Object.entries(HOME_LANES).forEach(([c,lane])=>{
      lane.forEach((coord,i)=>{
        const [r,col]=coord; out += cellRect(r,col,i===5?HEX[c]:`${HEX[c]}bb`,"#d7d0bf",1.3,3);
        if(i===5){const p=gridCenter(coord);out += circle(p.x,p.y,10,"#fff9e8","#fff",2);}
      });
    });
    // center triangles
    const center=gridCenter([7,7]), s=700/15;
    out += `<polygon points="${center.x},${center.y} ${6*s},${6*s} ${9*s},${6*s}" fill="${HEX.red}"/>`;
    out += `<polygon points="${center.x},${center.y} ${9*s},${6*s} ${9*s},${9*s}" fill="${HEX.green}"/>`;
    out += `<polygon points="${center.x},${center.y} ${9*s},${9*s} ${6*s},${9*s}" fill="${HEX.yellow}"/>`;
    out += `<polygon points="${center.x},${center.y} ${6*s},${9*s} ${6*s},${6*s}" fill="${HEX.blue}"/>`;
    out += `<circle cx="${center.x}" cy="${center.y}" r="10" fill="#fff8e9"/>`;
    // decorative labels
    out += `<text x="145" y="42" text-anchor="middle" font-size="14" font-weight="900" fill="#fff">RED</text>`;
    out += `<text x="555" y="42" text-anchor="middle" font-size="14" font-weight="900" fill="#103322">GREEN</text>`;
    out += `<text x="555" y="658" text-anchor="middle" font-size="14" font-weight="900" fill="#493300">YELLOW</text>`;
    out += `<text x="145" y="658" text-anchor="middle" font-size="14" font-weight="900" fill="#09294f">BLUE</text>`;
    svg.innerHTML=out;
  }
  function progressGlobal(color,progress) {
    return (START[color]+progress)%52;
  }
  function legalMoves(color,dice) {
    const tokens=game.players[color].tokens;
    return tokens.map((p,i)=>({i,p})).filter(({p})=>{
      if(p===-1) return dice===6;
      if(p>=57) return false;
      return p+dice<=57;
    }).map(m=>m.i);
  }
  function isSafe(global) { return SAFE.has(global); }
  function tokenCoord(color,idx) {
    const p=game.players[color].tokens[idx];
    if(p===-1) return YARDS[color][idx];
    if(p>=57) {
      const lane=HOME_LANES[color][5];
      return [lane[0]+(idx-1.5)*.22,lane[1]+(idx-1.5)*.22];
    }
    if(p>=52) return HOME_LANES[color][p-52];
    const g=progressGlobal(color,p);
    return TRACK[g] || TRACK[0];
  }
  function tokenScreenCoord(color,idx) {
    const p=game.players[color].tokens[idx];
    if(p>=0 && p<52) {
      const global=progressGlobal(color,p);
      const coord=TRACK[global];
      const same=[];
      COLORS.forEach(c=>game.players[c].tokens.forEach((q,j)=>{
        if(q>=0&&q<52&&progressGlobal(c,q)===global) same.push([c,j]);
      }));
      const rank=same.findIndex(([c,j])=>c===color&&j===idx);
      const offsets=[[0,0],[-.17,-.17],[.17,-.17],[-.17,.17],[.17,.17]];
      const off=offsets[Math.min(rank,4)];
      return [coord[0]+(off[1]||0),coord[1]+(off[0]||0)];
    }
    const coord=tokenCoord(color,idx);
    return coord;
  }
  function renderTokens() {
    tokenLayer.innerHTML="";
    COLORS.forEach(color=>{
      game.players[color].tokens.forEach((p,i)=>{
        const [r,c]=tokenScreenCoord(color,i);
        const x=(c+.5)*100/15, y=(r+.5)*100/15;
        const b=document.createElement("button");
        b.className=`token-button ${color}`;
        b.style.left=`${x}%`; b.style.top=`${y}%`;
        b.textContent=String(i+1);
        b.title=`${LABEL[color]} token ${i+1}`;
        b.setAttribute("aria-label",`${LABEL[color]} token ${i+1}`);
        const canChoose=game.waiting && COLORS[game.turn]===color && legalMoves(color,game.dice).includes(i);
        b.classList.toggle("selectable",canChoose);
        b.disabled=!canChoose || (game.mode==="bots" && color!=="red");
        b.addEventListener("click",()=>playMove(color,i));
        tokenLayer.appendChild(b);
      });
    });
  }
  function renderPlayers() {
    $("playerList").innerHTML="";
    COLORS.forEach((c,i)=>{
      const home=game.players[c].tokens.filter(p=>p===57).length;
      const out=game.players[c].tokens.filter(p=>p>=0&&p<57).length;
      const row=document.createElement("div");
      row.className="player-row"+(i===game.turn&&!game.winner?" active":"");
      row.innerHTML=`<span class="player-dot" style="background:${HEX[c]}"></span><span class="player-info"><strong>${LABEL[c]}${game.mode==="bots"&&c!=="red"?" · Bot":game.mode==="bots"?" · You":""}</strong><small>${home===4?"Finished":out===0?"In the yard":`${out} token${out===1?"":"s"} on the board`}</small></span><span class="player-count">${home}/4 🏠</span>`;
      $("playerList").appendChild(row);
    });
  }
  function renderAll() {
    if(!game) return;
    $("currentTurn").textContent=game.winner?`${LABEL[game.winner]} wins`:LABEL[COLORS[game.turn]];
    $("turnAvatar").textContent=game.winner?LABEL[game.winner][0]:LABEL[COLORS[game.turn]][0];
    $("turnAvatar").className=`turn-avatar ${game.winner||COLORS[game.turn]}`;
    $("gameStatus").innerHTML=`<span class="status-dot" style="background:${game.winner?HEX[game.winner]:HEX[COLORS[game.turn]]}"></span>${game.winner?"Match complete":game.waiting?"Choose a token":"Waiting for roll"}`;
    $("diceBtn").disabled=!!game.winner||game.waiting||(game.mode==="bots"&&COLORS[game.turn]!=="red");
    renderTokens(); renderPlayers();
  }
  function rollDice() {
    if(game.winner||game.waiting||(game.mode==="bots"&&COLORS[game.turn]!=="red")) return;
    const color=COLORS[game.turn];
    const value=1+Math.floor(Math.random()*6);
    game.dice=value; game.lastRoll=value;
    $("diceFace").textContent=["","⚀","⚁","⚂","⚃","⚄","⚅"][value];
    sound(360+value*70,.12);
    if(value===6) game.consecutiveSixes++; else game.consecutiveSixes=0;
    if(game.consecutiveSixes>=3) {
      game.consecutiveSixes=0; game.dice=null;
      $("notice").textContent=`${LABEL[color]} rolled three sixes in a row. Turn forfeited.`;
      showToast("Three sixes — turn forfeited");
      nextTurn(false); return;
    }
    const moves=legalMoves(color,value);
    if(!moves.length) {
      $("notice").textContent=`${LABEL[color]} rolled ${value}, but has no legal move.`;
      if(value!==6) nextTurn(false);
      else { $("notice").textContent+= " Roll again for the bonus turn."; game.dice=null; renderAll(); }
      return;
    }
    game.waiting=true;
    $("notice").textContent=`${LABEL[color]} rolled ${value}. ${moves.length===1?"One legal token is highlighted.":"Choose a highlighted token."}`;
    renderAll();
    if(game.mode==="bots"&&color!=="red") {
      botTimer=setTimeout(()=> {
        if(!game.waiting||game.winner) return;
        const chosen=chooseBotMove(color,moves,value);
        playMove(color,chosen);
      },600+Math.random()*500);
    }
  }
  function chooseBotMove(color,moves,dice) {
    const difficulty=game.difficulty;
    const scored=moves.map(i=>{
      const p=game.players[color].tokens[i];
      const next=p===-1?0:p+dice;
      let score=Math.random()*(difficulty==="easy"?20:difficulty==="normal"?9:3);
      if(p===-1) score+=difficulty==="easy"?5:18;
      if(next===57) score+=100;
      if(next>=52) score+=20;
      if(next<52) {
        const landing=progressGlobal(color,next);
        if(!isSafe(landing)) {
          const capture=COLORS.some(other=>other!==color&&game.players[other].tokens.some(q=>q>=0&&q<52&&progressGlobal(other,q)===landing));
          if(capture) score+=difficulty==="easy"?12:35;
        }
        const threat=COLORS.some(other=>other!==color&&game.players[other].tokens.some(q=>q>=0&&q<52&&progressGlobal(other,q)===progressGlobal(color,next+1)));
        if(threat) score-=difficulty==="hard"?15:4;
      }
      score+=next*(difficulty==="hard"?1.2:.45);
      if(dice===6&&p===-1) score+=10;
      return {i,score};
    });
    scored.sort((a,b)=>b.score-a.score);
    return scored[0].i;
  }
  function playMove(color,index) {
    if(!game.waiting||game.winner||COLORS[game.turn]!==color) return;
    const dice=game.dice;
    if(!legalMoves(color,dice).includes(index)) return;
    let p=game.players[color].tokens[index];
    const wasYard=p===-1;
    p=wasYard?0:p+dice;
    game.players[color].tokens[index]=p;
    let captured=0;
    if(p<52) {
      const landing=progressGlobal(color,p);
      if(!isSafe(landing)) {
        COLORS.filter(c=>c!==color).forEach(other=>{
          game.players[other].tokens=game.players[other].tokens.map(q=>{
            if(q>=0&&q<52&&progressGlobal(other,q)===landing){captured++;return -1;}
            return q;
          });
        });
      }
    }
    const finished=p===57;
    const won=game.players[color].tokens.every(q=>q===57);
    game.waiting=false; game.dice=null;
    sound(finished?850:captured?700:500,.09);
    let text=`${LABEL[color]} moved token ${index+1}.`;
    if(wasYard) text=`${LABEL[color]} brought token ${index+1} out.`;
    if(captured) text+=` Captured ${captured} opponent token${captured>1?"s":""}!`;
    if(finished) text+=` Token reached home!`;
    $("notice").textContent=text;
    if(won) {
      game.winner=color;
      renderAll();
      $("modalTitle").textContent=`${LABEL[color]} wins!`;
      $("modalText").textContent=game.mode==="bots"&&color==="red"?"Great game! You brought all four tokens home.":`${LABEL[color]} brought all four tokens home.`;
      $("modalBackdrop").classList.remove("hidden");
      sound(880,.22); setTimeout(()=>sound(1100,.22),180);
      return;
    }
    const extra=dice===6||captured>0||finished;
    if(!extra) nextTurn(false);
    else {
      game.consecutiveSixes = dice===6 ? game.consecutiveSixes : 0;
      $("notice").textContent += " Bonus turn!";
      renderAll();
      if(game.mode==="bots"&&COLORS[game.turn]!=="red") scheduleBot();
    }
    renderAll();
  }
  function nextTurn(keepSix=false) {
    game.waiting=false; game.dice=null;
    if(!keepSix) game.consecutiveSixes=0;
    game.turn=(game.turn+1)%4;
    $("diceFace").textContent="—";
    renderAll();
    if(game.mode==="bots"&&COLORS[game.turn]!=="red") scheduleBot();
  }
  function scheduleBot() {
    clearTimeout(botTimer);
    botTimer=setTimeout(()=>{
      if(game.winner||game.mode!=="bots"||COLORS[game.turn]==="red") return;
      rollDice();
    },550);
  }
  function help() {
    $("modalTitle").textContent="Rules & controls";
    $("modalText").innerHTML="Roll a six to bring a token out. Move clockwise around the track and enter your own home lane after one full lap. You must roll the exact number to finish. Landing on an unprotected opponent captures it; marked safe squares protect tokens. A six, capture, or finish gives another turn. Three sixes consecutively forfeit the turn. In Red vs 3 bots, click highlighted Red tokens to move.";
    $("modalBackdrop").classList.remove("hidden");
    $("playAgainBtn").textContent="Got it";
  }
  $("diceBtn").addEventListener("click",rollDice);
  $("newGameBtn").addEventListener("click",initGame);
  $("playAgainBtn").addEventListener("click",()=>{ $("playAgainBtn").textContent="Play again";initGame(); });
  $("closeModal").addEventListener("click",()=>{$("modalBackdrop").classList.add("hidden");$("playAgainBtn").textContent="Play again";});
  $("helpBtn").addEventListener("click",help);
  $("difficulty").addEventListener("change",()=>{if(game)game.difficulty=$("difficulty").value;});
  $("mode").addEventListener("change",initGame);
  $("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"🔊":"🔇";showToast(soundOn?"Sound on":"Sound muted");if(soundOn)sound();});
  drawBoard();
  initGame();
})();
