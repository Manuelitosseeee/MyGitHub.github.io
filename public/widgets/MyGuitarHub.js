// MyGuitarHub · widget per Scriptable su iPhone e iPad.
// Parametro del widget: incolla il JSON copiato dalla stanza di un amico.
const widget = new ListWidget();
widget.backgroundColor = new Color('#121212');
widget.setPadding(12, 12, 12, 12);
widget.refreshAfterDate = new Date(Date.now() + 5 * 60 * 1000);
try {
  let raw = args.widgetParameter;
  if (!raw && config.runsInApp) {
    const a = new Alert(); a.title = 'MyGuitarHub';
    a.message = 'Incolla la configurazione copiata da Amici → stanza → Configura widget.';
    a.addTextField('Configurazione JSON'); a.addAction('Anteprima');
    await a.presentAlert(); raw = a.textFieldValue(0);
  }
  const settings = JSON.parse(raw || '{}');
  const endpoint = 'https://myguitarhub-friends.manuelitosmurf.workers.dev/v1/widget';
  if (settings.api !== endpoint || !settings.token) throw new Error('Configura il parametro del widget.');
  const request = new Request(endpoint);
  request.headers = {Authorization: 'Bearer ' + settings.token};
  request.timeoutInterval = 15;
  const data = await request.loadJSON();
  if (request.response.statusCode !== 200) throw new Error(data.error || 'Amicizia non disponibile.');
  widget.url = data.openURL;
  const title = widget.addText(data.nickname); title.textColor = Color.white(); title.font = Font.boldSystemFont(14);
  widget.addSpacer(4);
  const state = widget.addText(data.studying ? 'Sta studiando' : 'Si riposa');
  state.textColor = new Color('#cccccc'); state.font = Font.systemFont(11);
  if (data.snapshot) {
    widget.addSpacer(5);
    const bytes = Data.fromBase64String(data.snapshot.split(',')[1]);
    const image = widget.addImage(Image.fromData(bytes));
    image.resizable = true; image.applyFittingContentMode(); image.centerAlignImage();
  }
  widget.addSpacer();
  const date = data.updated ? new Date(data.updated) : null;
  const footer = widget.addText(date ? 'Ultimo contatto ' + date.toLocaleTimeString('it-IT', {hour:'2-digit',minute:'2-digit'}) : 'In attesa della stanza');
  footer.font = Font.systemFont(9); footer.textColor = new Color('#aaaaaa');
} catch (error) {
  widget.addText('MyGuitarHub').textColor = Color.white();
  const text = widget.addText(String(error.message || error)); text.textColor = new Color('#bbbbbb'); text.font = Font.systemFont(12);
}
Script.setWidget(widget);
if (config.runsInApp) await widget.presentLarge();
Script.complete();
