/* eslint-disable no-extra-boolean-cast */
import Quill, {getNewQuill, options} from '../modules/quill/AdeleQuill';
import Delta from 'quill-delta';
import { trim } from '../modules/quill/MarkupUtils';

import _isEmpty from 'lodash/isEmpty';

var EditorMixin = {

  data() {
    return {
      storeActions: {
      },
      editor: null,
      editorContentElement: null,
      editorHasFocus: false,
      currentSelection: null,
      formTextfield: null,
      actionsPositions: {
        top: 0, left: 0, right: 0, bottom: 0
      },
      editorInited: false,
    }
  },

  methods: {

    initEditor(editorElement, initialContent) {
      editorElement.innerHTML = trim(initialContent);
      this.editor = getNewQuill(editorElement);
      this.editor.updateContents(new Delta().retain(this.editor.getLength(), 'api'))
      this.editorContentElement = editorElement.children[0];
      this.editorInited = true;
      this.activateEvents();
    },

    activateEvents () {
      //console.log("EditorMixins.activateEvents")
      this.editor.on('selection-change', (range) => {
        if (range === null || range.length === 0) {
          this.updateButtons({})
          this.defineNewNote = false
          this.selectedSpeechpartId = null
        }
        if (range) {
          this.setRangeBound(range);
          let formats = this.editor.getFormat(range.index, range.length);
          this.updateButtons(formats);
          console.log("onSelection", range, formats)
          if (!!formats.note) {
            this.onNoteSelected(formats.note, range);
            this.buttons.note = true;
          } else {
            this.selectedNoteId = null;
            this.buttons.note = false;
          }
          
          // speechparts
          if (range.length > 0) {
            if (formats.speechpart) {
              this.onSpeechpartSelected(formats.speechpart, range);
              const spId = formats.speechpart.split(',')[0]
              const sp = this.speechparts.find(e => e.id === parseInt(spId))
              console.log("ID SP", sp)
              this.currentSpeechpart = sp
              //this.buttons.speechpart = false;
            } else {
              this.selectedSpeechpartId = range.index;
              //this.buttons.speechpart = true;
            }
          }

          this.currentSelection = range
        }
        this.editorHasFocus = this.editor.hasFocus();
      });
      //this.editor.on('selection-change', this.onSelection);
      //this.editor.on('selection-change', this.onFocus);
      this.editor.on('text-change', this.onTextChange);
    },
    deactivateEvents () {
      console.log("EditorMixins.deactivateEvents")
      if (this.editor) {
        this.editor.off('selection-change', this.onSelection);
        this.editor.off('selection-change', this.onFocus);
        this.editor.off('text-change', this.onTextChange);
      }
    },

    getEditorHTML () {
      return this.editorContentElement.innerHTML;
    },

    /**************
     *
     * EDITOR EVENT HANDLERS
     */

    onTextChange (delta, oldDelta, source) {
      this.lastOperations = delta;
      if (this.editorInited) {
        if (typeof this.storeActions.changed === 'string') {
          this.$store.dispatch(this.storeActions.changed, delta)
        } else {
          this.storeActions.changed(delta)
        }
      }
    },
    onSelection (range) {
 
    },
    onFocus () {
      this.editorHasFocus = this.editor.hasFocus();
    },

    simpleFormat(formatName) {
      let selection = this.editor.getSelection();
      let format = this.editor.getFormat(selection.index, selection.length);
      let value = !format[formatName];
      this.editor.format(formatName, value);
      let formats = this.editor.getFormat(selection.index, selection.length);
      this.updateButtons(formats);
    },

    insertSegment () {
      let range = this.editor.getSelection(true);
      this.editor.updateContents(new Delta().retain(range.index).insert({ segment: true }), Quill.sources.USER);
      console.log('insert seg', this.editor.getContents())
      this.editor.setSelection(range.index + 1, Quill.sources.SILENT);
    },
    deleteSegment () {
      console.log("delete segment", this.editor.getSelection())
    },
    insertColBreak () {

      let range = this.editor.getSelection(true);
      this.editor.updateContents(new Delta().retain(range.index).delete(range.length).insert({ colbreak: true }), Quill.sources.USER);
      this.editor.setSelection(range.index + 1, Quill.sources.SILENT);

    },

    updateButtons (formats) {
      if (_isEmpty(formats)) formats = { }
      for (let key in this.buttons) {
        this.buttons[key] = !!formats[key];
      }
    },

    setRangeBound (range) {
      /** get and set the range bound of the selection to locate the actions bar **/
      //console.log("setRangeBound", range);
      let rangeBounds = this.editor.getBounds(range);
      this.actionsPositions.left = rangeBounds.left;
      this.actionsPositions.right = rangeBounds.right;
      this.actionsPositions.bottom = rangeBounds.bottom;
    },

    /**************
     *
     * TEXTFIELD FORM METHODS
     */

    displayTextfieldForm (formData) {
      let format = this.editor.getFormat();
      formData.value = format[formData.format];
      this.formTextfield = formData;
    },
    cancelTextfieldForm () {
      this.formTextfield = null;
    },
    submitTextfieldForm (data) {
      this.editor.format(this.formTextfield.format, data);
      this.cancelTextfieldForm();
      let formats = this.editor.getFormat();
      this.updateButtons(formats)
    },
    removeFormat () {
      console.log("removeFormat", this.formTextfield.format)
      const formatName = this.formTextfield.format;
      const selection = this.editor.getSelection();
      this.editor.format(formatName, '');
      this.cancelTextfieldForm();
      let formats = this.editor.getFormat(selection.index, selection.length);
      this.updateButtons(formats);
    },

    /**************
     *
     * LOCATION METHODS
     */

    displayLocationForm() {
      this.displayTextfieldForm ({
        format: 'location',
        title: '<i class="fas fa-map-marker-alt"></i> Identifier un lieu',
        label: 'Nom du lieu'
      });
    },

    /**************
     *
     * PERSON METHODS
     */

    displayPersonForm() {
      this.displayTextfieldForm ({
        format: 'person',
        title: '<i class="fas fa-user"></i> Identifier une personne',
        label: 'Nom de la personne'
      });
    },

    /**************
     *
     * PERSON METHODS
     */

    displayCiteForm() {
      this.displayTextfieldForm ({
        format: 'cite',
        title: '<i class="fas fa-book"></i> Ajouter une mention bibliographique',
        label: 'Référence'
      });
    }


  },

  computed: {
    actionsPosition () {
      /** get the actions bar position **/
      let top = this.actionsPositions.bottom + 5;
      let left = (this.actionsPositions.left+this.actionsPositions.right)/2;
      return `top:${top}px;left:${left}px`;
    }
  }

}


export default EditorMixin;