(function() {
  var CONFIG, addMessage, longPoll, nicks, onConnect, outputUsers, rss, scrollDown, send, showChat, showConnect, showLoad, starttime, updateRSS, updateTitle, updateUptime, updateUsersLink, userJoin, userPart, util, who, ytswf;
  CONFIG = {
    debug: false,
    nick: "#",
    id: null,
    last_message_time: 1,
    focus: true,
    unread: 0
  };
  nicks = [];
  Date.prototype.toRelativeTime = function(now_threshold) {
    var conversions, delta, key, units, _i, _len;
    delta = new Date() - this;
    now_threshold = parseInt(now_threshold, 10);
    if (isNaN(now_threshold)) {
      now_threshold = 0;
    }
    if (delta <= now_threshold) {
      return 'Just now';
    }
    units = null;
    conversions = {
      millisecond: 1,
      second: 1000,
      minute: 60,
      hour: 60,
      day: 24,
      month: 30,
      year: 12
    };
    for (_i = 0, _len = conversions.length; _i < _len; _i++) {
      key = conversions[_i];
      if (delta < conversions[key]) {
        break;
      } else {
        units = key;
        delta = delta / conversions[key];
      }
    }
    delta = Math.floor(delta);
    if (delta !== 1) {
      units += "s";
    }
    return [delta, units].join(" ");
  };
  Date.fromString = function(str) {
    return new Date(Date.parse(str));
  };
  updateUsersLink = function() {
    var t;
    t = nicks.length.toString() + " user";
    if (nicks.length !== 1) {
      t += "s";
    }
    return $("#usersLink").text(t);
  };
  userJoin = function(joining, timestamp) {
    var nick, _i, _len;
    addMessage(joining, "joined", timestamp, "join");
    for (_i = 0, _len = nicks.length; _i < _len; _i++) {
      nick = nicks[_i];
      if (nick === joining) {
        return;
      }
    }
    nicks.push(joining);
    return updateUsersLink();
  };
  userPart = function(parting, timestamp) {
    var nick, _i, _len;
    addMessage(parting, "left", timestamp, "part");
    for (_i = 0, _len = nicks.length; _i < _len; _i++) {
      nick = nicks[_i];
      if (nick === parting) {
        nicks.splice(i, 1);
        break;
      }
    }
    return updateUsersLink();
  };
  util = {
    urlRE: /https?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g,
    toStaticHTML: function(inputHtml) {
      inputHtml = inputHtml.toString();
      return inputHtml.replace(/&/g, "&amp").replace(/</g, "&lt").replace(/>/g, "&gt");
    },
    zeroPad: function(digits, n) {
      n = n.toString();
      while (n.length < digits) {
        n = '0' + n;
      }
      return n;
    },
    timeString: function(date) {
      var hours, minutes;
      minutes = date.getMinutes().toString();
      hours = date.getHours().toString();
      return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes);
    },
    isBlank: function(text) {
      var blank;
      blank = /^\s*$/;
      return text.match(blank) !== null;
    }
  };
  scrollDown = function() {
    $('#log').scrollTop(1000000);
    return $("#entry").focus();
  };
  addMessage = function(from, text, time, _class) {
    var content, messageElement, nick_re;
    if (text === null) {
      return;
    }
    if (time === null) {
      time = new Date();
    } else if ((time instanceof Date) === false) {
      time = new Date(time);
    }
    messageElement = $(document.createElement("table"));
    messageElement.addClass("message");
    if (_class) {
      messageElement.addClass(_class);
    }
    text = util.toStaticHTML(text);
    nick_re = new RegExp(CONFIG.nick);
    if (nick_re.exec(text)) {
      messageElement.addClass("personal");
    }
    text = text.replace(util.urlRE, '<a target="_blank" href="$&">$&</a>');
    content = "<tr>\n   <td class=\"date\">" + (util.timeString(time)) + "</td>\n   <td class=\"nick\">" + (util.toStaticHTML(from)) + "</td>\n   <td class=\"msg-text\">" + text + "</td>\n</tr>";
    messageElement.html(content);
    $("#log").append(messageElement);
    return scrollDown();
  };
  updateRSS = function() {
    var bytes, megabytes;
    bytes = parseInt(rss);
    if (bytes) {
      megabytes = bytes / (1024 * 1024);
      megabytes = Math.round(megabytes * 10) / 10;
      return $("#rss").text(megabytes.toString());
    }
  };
  updateUptime = function() {
    if (starttime) {
      return $("#uptime").text(starttime.toRelativeTime());
    }
  };
  window.transmission_errors = 0;
  window.first_poll = true;
  window.songs = [];
  window.playback_started = false;
  window.currentSong = null;
  window.local_playback = false;
  window.stopLocalPlayback = function() {
    window.local_playback = false;
    window.playback_started = false;
    if (window.currentSong) {
      window.currentSong.stop();
      window.currentSong.destruct();
      return window.currentSong = null;
    }
  };
  window.enableLocalPlayback = function() {
    window.local_playback = true;
    window.playback_started = true;
    return songFinishCallback();
  };
  window.skipCurrentSong = function() {
    if (window.currentSong) {
      window.currentSong.stop();
      window.currentSong.destruct();
      window.currentSong = null;
    }
    return songFinishCallback();
  };
  window.songFinishCallback = function() {
    var playback_started, song;
    if (window.local_playback) {
      song = window.songs[0];
      window.songs = window.songs.splice(1, window.songs.length);
      console.log(song);
      if (song) {
        $('#song_list li:first-child').remove();
        $('#current_song').html(song.text);
        window.currentSong = soundManager.createSound({
          id: song.text,
          url: "/tmp/" + escape(song.text),
          onfinish: songFinishCallback
        });
        return soundManager.play(song.text);
      } else {
        $('#current_song').html("");
        return playback_started = false;
      }
    }
  };
  window.startPlayback = function(message) {
    var first_song, startSong;
    if (!window.playback_started && window.local_playback) {
      window.playback_started = true;
      first_song = message;
      startSong = function() {
        $('#song_list li:first-child').remove();
        $('#current_song').html(first_song.text);
        window.currentSong = soundManager.createSound({
          id: first_song.text,
          url: "/tmp/" + escape(first_song.text),
          onfinish: songFinishCallback
        });
        return window.currentSong.play(first_song.text);
      };
      return soundManager.onready(startSong);
    } else {
      return window.songs = window.songs.concat(message);
    }
  };
  longPoll = function(data) {
    var first_poll, message, rss, _i, _len, _ref;
    if (transmission_errors > 2) {
      showConnect();
      return;
    }
    if (data && data.rss) {
      rss = data.rss;
      updateRSS();
    }
    if (data && data.messages) {
      _ref = data.messages;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        message = _ref[_i];
        if (message.timestamp > CONFIG.last_message_time) {
          CONFIG.last_message_time = message.timestamp;
        }
        switch (message.type) {
          case "msg":
            if (!CONFIG.focus) {
              CONFIG.unread++;
            }
            addMessage(message.nick, message.text, message.timestamp);
            break;
          case "join":
            userJoin(message.nick, message.timestamp);
            break;
          case "part":
            userPart(message.nick, message.timestamp);
            break;
          case "youtube":
            if (ytswf) {
              ytswf.loadVideoById(message.text);
            }
            console.log('youtube');
            break;
          case "upload":
            addMessage("room", "uploaded " + message.text, message.timestamp, "join");
            $('#song_list').append("<li>" + message.text + "</li>");
            startPlayback(message);
        }
      }
      updateTitle();
      if (first_poll) {
        first_poll = false;
        who();
      }
    }
    return $.ajax({
      cache: false,
      type: "GET",
      url: "/recv",
      dataType: "json",
      data: {
        since: CONFIG.last_message_time,
        id: CONFIG.id
      },
      error: function() {
        addMessage("", "long poll error. trying again...", new Date(), "error");
        transmission_errors += 1;
        return setTimeout(longPoll, 10 * 1000);
      },
      success: function(data) {
        var transmission_errors;
        transmission_errors = 0;
        return longPoll(data);
      }
    });
  };
  send = function(msg) {
    var fun;
    if (CONFIG.debug === false) {
      fun = function() {};
      return jQuery.get("/send", {
        id: CONFIG.id,
        text: msg
      }, fun, "json");
    }
  };
  showConnect = function() {
    $("#connect").show();
    return $("#nickInput").focus();
  };
  showLoad = function() {
    $("#connect").hide();
    $("#loading").show();
    return $("#toolbar").hide();
  };
  showChat = function(nick) {
    $("#toolbar").show();
    $("#entry").focus();
    $("#entry").show();
    $("#connect").hide();
    $("#loading").hide();
    return scrollDown();
  };
  updateTitle = function() {
    if (CONFIG.unread) {
      return document.title = "(" + CONFIG.unread.toString() + ") node chat";
    } else {
      return document.title = "node chat";
    }
  };
  starttime = null;
  rss = null;
  ytswf = null;
  onConnect = function(session) {
    if (session.error) {
      alert("error connecting: " + session.error);
      showConnect();
      return;
    }
    CONFIG.nick = session.nick;
    CONFIG.id = session.id;
    starttime = new Date(session.starttime);
    rss = session.rss;
    showChat(CONFIG.nick);
    $(window).bind("blur", function() {
      CONFIG.focus = false;
      return updateTitle();
    });
    return $(window).bind("focus", function() {
      CONFIG.focus = true;
      CONFIG.unread = 0;
      return updateTitle();
    });
  };
  outputUsers = function() {
    var nick_string;
    nick_string = nicks.length > 0 ? nicks.join(", ") : "(none)";
    addMessage("users:", nick_string, new Date(), "notice");
    return false;
  };
  who = function() {
    return jQuery.get("/who", {}, function(data, status) {
      if (status !== "success") {
        return;
      }
      nicks = data.nicks;
      return outputUsers();
    }, "json");
  };
  $(document).ready(function() {
    var atts, params;
    $("#entry").keypress(function(e) {
      var msg;
      if (e.keyCode !== 13) {
        return;
      }
      msg = $("#entry").attr("value").replace("\n", "");
      if (!util.isBlank(msg)) {
        send(msg);
      }
      return $("#entry").attr("value", "");
    });
    $("#usersLink").click(outputUsers);
    $("#connectButton").click(function() {
      var ajax_params, nick;
      showLoad();
      nick = $("#nickInput").attr("value");
      if (nick.length > 50) {
        alert("Nick too long. 50 character max.");
        showConnect();
        return false;
      }
      if (/[^\w_\-^!]/.exec(nick)) {
        alert("Bad character in nick. Can only have letters, numbers, and '_', '-', '^', '!'");
        showConnect();
        return false;
      }
      ajax_params = {
        cache: false,
        type: "GET",
        dataType: "json",
        url: "/join",
        data: {
          nick: nick
        },
        error: function(response) {
          console.log(response);
          alert("error connecting to server");
          return showConnect();
        },
        success: onConnect
      };
      $.ajax(ajax_params);
      return false;
    });
    $("#youtube_form").submit(function() {
      var ajax_params;
      try {
        ajax_params = {
          cache: false,
          type: "POST",
          dataType: "json",
          url: "/submit_youtube_link",
          data: {
            nick: 'hey'
          },
          error: function(response) {
            return console.log(response);
          },
          success: function() {}
        };
        $.ajax(ajax_params);
      } catch (error) {
        alert(error);
      }
      return false;
    });
    params = {
      allowScriptAccess: "always"
    };
    atts = {
      id: "myytplayer"
    };
    swfobject.embedSWF("http://www.youtube.com/apiplayer?enablejsapi=1&version=3", "ytapiplayer", "1", "1", "8", null, null, params, atts);
    if (CONFIG.debug) {
      $("#loading").hide();
      $("#connect").hide();
      scrollDown();
      return;
    }
    $("#log table").remove();
    longPoll();
    return showConnect();
  });
  $(window).unload(function() {
    return jQuery.get("/part", {
      id: CONFIG.id
    }, (function(data) {}), "json");
  });
}).call(this);
