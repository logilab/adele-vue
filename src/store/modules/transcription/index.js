import Quill from '../../../modules/quill/AdeleQuill';
import {http} from '../../../modules/http-common';

import {
  TEIToQuill,
  quillToTEI,
  convertLinebreakTEIToQuill,
  convertLinebreakQuillToTEI,
  insertSegments,
  insertFacsimileZones,
  stripSegments,
  computeAlignmentPointers
} from '../../../modules/quill/MarkupUtils'
import {filterDeltaOperations} from '../../../modules/quill/DeltaUtils'


const transcriptionShadowQuillElement = document.createElement('div');
const transcriptionWithTextAlignmentShadowQuillElement = document.createElement('div');
const facsimileShadowQuillElement = document.createElement('div');
let transcriptionShadowQuill;
let transcriptionWithTextAlignmentShadowQuill;
let facsimileShadowQuill;

const state = {

  transcriptionLoading: true,
  transcription: null,
  transcriptionContent: null,
  transcriptionWithNotes: null,
  transcriptionWithTextAlignment: null,
  transcriptionWithFacsimile: null,
  transcriptionSaved: true,
  translationAlignmentSaved: true,
  transcriptionError: null,
  translationAlignmentError: null,
  textAlignmentSegments: [],
  savingStatus: 'uptodate'
};

const mutations = {


  INIT(state, payload) {
      transcriptionShadowQuillElement.innerHTML = "<p></p>" 
      transcriptionShadowQuill = new Quill(transcriptionShadowQuillElement);
      transcriptionShadowQuillElement.children[0].innerHTML = payload.content || "";
      state.transcriptionContent = transcriptionShadowQuillElement.children[0].innerHTML;
      //console.log("INIT with content", state.transcriptionContent);

      transcriptionWithTextAlignmentShadowQuillElement.innerHTML = "<p></p>" 
      transcriptionWithTextAlignmentShadowQuill = new Quill(transcriptionWithTextAlignmentShadowQuillElement);
      transcriptionWithTextAlignmentShadowQuillElement.children[0].innerHTML = payload.withTextAlignment || "";
      state.transcriptionWithTextAlignment = transcriptionWithTextAlignmentShadowQuillElement.children[0].innerHTML;
      
      facsimileShadowQuillElement.innerHTML = "<p></p>" 
      facsimileShadowQuill = new Quill(facsimileShadowQuillElement);
      facsimileShadowQuillElement.children[0].innerHTML = payload.withFacsimile || "";
      state.transcriptionWithFacsimile = facsimileShadowQuillElement.children[0].innerHTML;
  },
  RESET(state) {

    console.log("STORE MUTATION transcription/RESET");
    state.transcription = null;
    state.textAlignmentSegments = [];
    state.transcriptionContent = null;
    state.transcriptionWithTextAlignment = null;
    state.transcriptionWithFacsimile = null;

    if (transcriptionShadowQuillElement && transcriptionShadowQuillElement.children[0]) transcriptionShadowQuillElement.children[0].innerHTML = "";
    if (transcriptionWithTextAlignmentShadowQuillElement && transcriptionWithTextAlignmentShadowQuillElement.children[0]) transcriptionWithTextAlignmentShadowQuillElement.children[0].innerHTML = "";
    if (facsimileShadowQuillElement && facsimileShadowQuillElement.children[0]) facsimileShadowQuillElement.children[0].innerHTML = "";
    
  },
  SET_ERROR(state, payload) {
    state.transcriptionError = payload
  },
  SET_TEXT_ALIGNMENT_ERROR(state, payload) {
    state.translationAlignmentError = payload
  },
  LOADING_STATUS (state, payload) {
    state.transcriptionLoading = payload;
  },
  SAVING_STATUS (state, payload) {
    //console.log("STORE MUTATION transcription/SAVING_STATUS", payload)
    state.savingStatus = payload;
  },
  STORE_ALIGNMENTS(state, payload) {
    state.textAlignmentSegments = payload;
  },
  UPDATE (state, payload) {
    if (payload.transcription) {
      state.transcription = payload.transcription;
    }
    if (payload.withTextAlignment) {
      state.transcriptionWithTextAlignment = payload.withTextAlignment;
    }
    if (payload.withFacsimile) {
      state.transcriptionWithFacsimile = payload.withFacsimile;
    }
    //state.transcriptionSaved = true;
  },
  CHANGED (state) {
    // transcription changed and needs to be saved
    state.transcriptionSaved = false;
  },
  ADD_TRANSLATION_ALIGNMENT_OPERATION (state, payload) {
    const deltaFilteredForTextAlignment = filterDeltaOperations(transcriptionWithTextAlignmentShadowQuill, payload, 'text-alignment');
    transcriptionWithTextAlignmentShadowQuill.updateContents(deltaFilteredForTextAlignment);
    state.transcriptionWithTextAlignment = transcriptionWithTextAlignmentShadowQuillElement.children[0].innerHTML;
  },
  ADD_OPERATION (state, payload) {

    const deltaFilteredForContent = filterDeltaOperations(transcriptionShadowQuill, payload, 'content');
    const deltaFilteredForFacsimile = filterDeltaOperations(facsimileShadowQuill, payload, 'facsimile');
  
    transcriptionShadowQuill.updateContents(deltaFilteredForContent);
    facsimileShadowQuill.updateContents(deltaFilteredForFacsimile);

    state.transcriptionContent = transcriptionShadowQuillElement.children[0].innerHTML;
    state.transcriptionWithFacsimile = facsimileShadowQuillElement.children[0].innerHTML;
  },
  SAVED (state) {
    // transcription saved
    state.transcriptionSaved = true;
  },
  SAVING_TRANSLATION_ALIGNMENT_STATUS (state, v) {
    state.translationAlignmentSaved = v;
  }

};

const actions = {
 
  /* useful */
  fetchTranscriptionFromUser ({dispatch, commit, state, getters, rootState}, {docId, userId}) {
    commit('RESET')
    commit('LOADING_STATUS', true);
    return http.get(`documents/${docId}/transcriptions/from-user/${userId}`).then(async response => {

      let transcription = response.data.data;
      let quillContent = TEIToQuill(transcription.content);
      
      const withFacsimile = insertFacsimileZones(quillContent, rootState.facsimile.alignments);
      const withTextAlignment = TEIToQuill(insertSegments(transcription.content, state.textAlignmentSegments));

      const data = {
        transcription: transcription,
        content: convertLinebreakTEIToQuill(quillContent),
        withTextAlignment: convertLinebreakTEIToQuill(withTextAlignment),
        withFacsimile: convertLinebreakTEIToQuill(withFacsimile),
      };

      commit('INIT', data);
      commit('UPDATE', data);
      commit('SET_ERROR', null)
      commit('LOADING_STATUS', false);
    }).catch((error) => {
      commit('SET_ERROR', error)
      commit('LOADING_STATUS', false);
      //throw error
    })
  },
  async fetchTranscriptionContent({dispatch, rootState, rootGetters}) {
    await dispatch('fetchTranscriptionFromUser', {
        docId: rootState.document.document.id,
        userId: rootState.workflow.selectedUserId
      })
    await dispatch('document/fetchTranscriptionView', 
    rootGetters['user/currentUserIsTeacher'] ? rootState.workflow.selectedUserId : rootState.document.document.user_id,
    {root: true})
   
  },
  /* useful */
  async fetchTextAlignments ({commit, rootState}) {
    const response = await http.get(`documents/${rootState.document.document.id}/transcriptions/alignments/from-user/${rootState.workflow.selectedUserId}`)
    if (response.data.errors) {
      commit('STORE_ALIGNMENTS', []);
      return;
    }
    const alignments = response.data.data && Array.isArray(response.data.data[0]) ? response.data.data : [response.data.data];
    commit('STORE_ALIGNMENTS', alignments);
  },
  /* useful */
  addNewTranscription ({commit, dispatch, rootState}) {
    const emptyTranscription = {
      data: {
        notes: [],
        content: ""
      }
    }
    return http.post(`documents/${rootState.document.document.id}/transcriptions/from-user/${rootState.workflow.selectedUserId}`, emptyTranscription).then(response => {
      commit('SET_ERROR', null)
    }).catch(error => {
      commit('SET_ERROR', error)
    })
  },
  /* useful */
  setError({commit}, payload) {
    commit('SET_ERROR', payload)
  },
  /* useful */
  async deleteTranscriptionFromUser({dispatch, commit}, {docId, userId}) {
    try {
      commit('SET_ERROR', null)
      const response = await http.delete(`documents/${docId}/transcriptions/from-user/${userId}`)
      await dispatch('document/partialUpdate', {
        validation_flags: response.data.data.validation_flags
      }, {root: true})
      await dispatch('fetchTranscriptionContent')
    } catch(error) {
      commit('SET_ERROR', error)
    }
  },
  /* useful */
  async saveTranscription({dispatch, commit, state, rootState, rootGetters}) {
    commit('SAVING_STATUS', 'tobesaved')
    commit('LOADING_STATUS', true)
    
    try {
      // put content
      await http.put(`documents/${rootState.document.document.id}/transcriptions/from-user/${rootState.workflow.selectedUserId}`, {
        data: {
          content: state.transcriptionContent,
        }
      })
            
      // update the store content
      
      await dispatch('fetchTranscriptionContent')

      commit('SAVING_STATUS', 'uptodate')
      commit('SET_ERROR', false)
      commit('LOADING_STATUS', false)
    } catch(error) {
      commit('SET_ERROR', error)
      commit('SAVING_STATUS', 'error')
      commit('LOADING_STATUS', false)
    }
  },
  insertSegments({commit, state}, segments) {
    const TEIwithSegments = insertSegments(quillToTEI(state.transcriptionContent), segments);
    const withTextAlignmentSegments = TEIToQuill(TEIwithSegments);
    const data = {
      withTextAlignment: convertLinebreakTEIToQuill(withTextAlignmentSegments)
    };

   transcriptionWithTextAlignmentShadowQuillElement.children[0].innerHTML = data.withTextAlignment;

    commit('UPDATE', data);
  },
  async cloneContent({dispatch, rootState}) {
    const doc_id = rootState.document.document.id;
    const user_id = rootState.workflow.selectedUserId;
    try {
      const response = await http.get(`documents/${doc_id}/transcriptions/clone/from-user/${user_id}`)
      await dispatch('document/unsetValidationFlag', {docId: doc_id, flagName: 'transcription'}, {root: true})
      return response.data;
    } catch (e) {
      console.log(`%c error while cloning transcription ${e}`, 'color:red');
    }
  },
  textAlignmentsNeedToBeSaved({commit}) {
    commit('SAVING_TRANSLATION_ALIGNMENT_STATUS', false)
  },
  async saveTranslationAlignment({commit, dispatch, state, rootGetters, rootState}) {
    commit('SAVING_TRANSLATION_ALIGNMENT_STATUS', false)
    commit('SET_TEXT_ALIGNMENT_ERROR', null)
    try {
      let data = []
      const transcription = rootGetters['transcription/transcriptionSegmentsFromQuill'];
      const translation = rootGetters['translation/translationSegmentsFromQuill'];
      
      if (transcription.length !== translation.length) {
        throw Error('Le nombre de segments doit être identique entre la transcription et la traduction')
      }

      for(let i = 0; i < transcription.length; i++) {
        data.push([...transcription[i], ...translation[i]])
      }
      console.log('save translation alignment', data)

      const response = await http.post(`documents/${rootState.document.document.id}/transcriptions/alignments/from-user/${rootState.workflow.selectedUserId}`, { data: data })
      commit('SAVING_TRANSLATION_ALIGNMENT_STATUS', true)

    } catch(error) {
      commit('SET_TEXT_ALIGNMENT_ERROR', error)
      commit('SAVING_TRANSLATION_ALIGNMENT_STATUS', false)
    } 
  },
  changed ({ commit, rootState }, {delta}) {
    if (rootState.workflow.transcriptionAlignmentMode) {
      commit('ADD_TRANSLATION_ALIGNMENT_OPERATION', delta);
    } else {
      commit('ADD_OPERATION', delta);
      commit('CHANGED');
      commit('SAVING_STATUS', 'tobesaved')
    }
  },
  reset({commit}) {
    commit('RESET')
  }

};

const getters = {
  isTranscriptionSaved(state) {
    return state.savingStatus === 'uptodate'
  },
  transcriptionSegmentsFromQuill(state) {
    if (!state.transcriptionWithTextAlignment) return [];

    const text =  quillToTEI(state.transcriptionWithTextAlignment)
    return computeAlignmentPointers(text)
  }
};

const transcriptionModule = {
  namespaced: true,
  state,
  mutations,
  actions,
  getters
};

export default transcriptionModule;
