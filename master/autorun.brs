sub Main()
  sys = CreateObject("roSystemLog")
  sys.SendLine("[BOOT] Inicio autorun Proyecto Olivo")

  mp   = CreateObject("roMessagePort")
  rect = CreateObject("roRectangle", 0, 0, 1920, 1080)

  config = {
    nodejs_enabled: true
    url: "file:///SD:/index.html"
  }

  html = CreateObject("roHtmlWidget", rect, config)
  html.SetPort(mp)
  html.Show()

  '---------------------------------
  ' Teclado / Control remoto USB
  '---------------------------------
  kb = CreateObject("roKeyboard")
  kb.SetPort(mp)
  sys.SendLine("[KEYBOARD] roKeyboard inicializado")

  '---------------------------------
  ' Loop principal
  '---------------------------------
while true
        ev = wait(0, mp)
        
        ' Eventos Teclado / Control remoto USB
        if ev <> invalid then
            eventType = type(ev)
            if eventType <> "" and eventType = "roKeyboardPress" then
                keyInt = ev.GetInt()
                js = "window.dispatchEvent(new KeyboardEvent('keydown', { keyCode: " + keyInt.tostr() + ", which: " + keyInt.tostr() + " }));"
                html.InjectJavascript(js)
            end if 
        end if

  end while
end sub