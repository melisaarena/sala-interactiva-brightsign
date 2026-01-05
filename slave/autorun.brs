sub Main()
  sys = CreateObject("roSystemLog")
  sys.SendLine("start")

  ' Lanzar el HTML con Node habilitado
  mp   = CreateObject("roMessagePort")
  rect = CreateObject("roRectangle", 0, 0, 1920, 1080)
  config = {
    nodejs_enabled: true,
    url: "file:///SD:/index.html"
  }
  html = CreateObject("roHtmlWidget", rect, config)
  html.SetPort(mp)
  html.Show()

  while true
    ev = wait(0, mp)
  end while
end sub
