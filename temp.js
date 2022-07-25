import { StatusBar } from "expo-status-bar";
import * as React from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  FlatList,
  ScrollView,
  Modal,
  Alert,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import * as ImagePicker from "expo-image-picker";
import {
  addDoc,
  doc,
  collection,
  getFirestore,
  getDocs,
  query,
  deleteDoc,
  orderBy,
  startAfter,
  limit,
  startAt,
  endBefore,
  updateDoc,
  setDoc,
  getDoc,
  where,
  increment,
} from "firebase/firestore/";
import { signOut, getAuth } from "firebase/auth";
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
  MenuProvider,
} from "react-native-popup-menu";
var aesjs = require("aes-js");
import Spinner from "react-native-loading-spinner-overlay";
const axios = require("axios").default;
import * as Progress from "react-native-progress";
/*import { TreewalkCarSplitter } from "carbites/treewalk";
import { CarReader } from "@ipld/car";
import { CarWriter } from "@ipld/car/lib/writer-browser";
import { pack } from "ipfs-car/dist/esm/pack";
import { packToBlob } from "ipfs-car/dist/esm/pack/blob";
import { MemoryBlockStore } from "ipfs-car/dist/esm/blockstore/memory";
import { NFTStorage } from "nft.storage";
import { Blockstore } from "nft.storage/src/platform";
import { BlockstoreCarReader } from "nft.storage/src/bs-car-reader";
import { transform } from "streaming-iterables";*/
import { FloatingMenu } from "react-native-floating-action-menu";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import config from "./config";
import { Web3Storage, File } from "web3.storage";
import copy from "copy-to-clipboard";

let mutexFoto = false;
let controllerFetch = new AbortController();
let controllerFetchDownload = new AbortController();
//ho modificato il costruttore in modo da accettare l'abort controller per poter annullare il caricamento
let web3s = new Web3Storage({
  token: config.Web3StorageToken,
  abortController: controllerFetch,
});

const Home = ({ route, navigation }) => {
  //per dimensioni finestra in real time
  const winSize = useWindowDimensions();

  //inizializzo databse e autenticazione firebase
  const db = getFirestore();
  const auth = getAuth();

  //state con array di immagini da caricare
  let [images, setImages] = React.useState([]);

  //state con array di cartelle da caricare
  let [folders, setFolders] = React.useState([]);

  //state per gestire cartelle
  let [stackDir, setStackDir] = React.useState(["Photos"]);

  //state per gestire barra caricamento
  let [progressValue, setProgressValue] = React.useState({
    value: 0,
    total: 100,
  });

  //inizializzo overlay caricamento
  let [spinnerVisible, setSpinnerVisibile] = React.useState(false);

  //per non mostrare pulsante durante reload e primo caricamento
  let [reload, setReload] = React.useState(false);

  //state apertura menu
  let [menuOpen, setMenuOpen] = React.useState(false);

  //numero file da caricare
  let [numFile, setNumFile] = React.useState({ current: 0, total: 0 });

  //per gestire poi il modal del menu del file o cartella
  let [elementoSelezionato, setElementoSelezionato] = React.useState({});

  //per selezionare il modal da mostrare 1=file 2 =folders 0=niente
  let [valueModal, setValueModal] = React.useState(0);

  let aggiornaFoto = function (newPhotoId) {
    return new Promise(async (resolve, reject) => {
      if (!mutexFoto) {
        mutexFoto = true;

        //prendo i cid da firebase prendo il zip dall url ipfs + cid lo unzippo e creo il blob per mostrarlo
        let data = await getDocs(
          query(
            collection(
              db,
              "Utenti",
              route.params.email.replaceAll(".", "DOT"),
              "Photos"
            ),
            orderBy("data", "desc"),
            where("dir", "==", stackDir)
          )
        );

        //carico cartelle
        setFolders([]);
        let listFold = await getDocs(
          query(
            collection(
              db,
              "Utenti",
              route.params.email.replaceAll(".", "DOT"),
              "folders"
            ),
            where("dir", "==", stackDir)
          )
        );

        //carico nome cartelle nello state
        for (let j = 0; j < listFold.docs.length; j++) {
          setFolders((oldFolders) => [
            ...oldFolders,
            {
              id: listFold.docs[j].id,
              name: listFold.docs[j].data().name,
              data: listFold.docs[j].data().data,
            },
          ]);
        }

        //uso questa i per sbloccare il mutex solo quando il fetch ha finito e sono state caricate
        //tutte le foto
        let i = 0;

        //sblocco il mutex se se è vuota la lista
        if (data.docs.length == 0) resolve();

        for (i; i < data.docs.length; i++) {
          //controllo se non è già presente nello state altrimenti ogni volta ad esempio che carichi un nuova foto
          //ricarica tutto
          if (
            !images.includes(
              images.filter((obj) => obj.id === data.docs[i].id)[0]
            )
          ) {
            let item = {
              cid: data.docs[i].data().cid,
              data: data.docs[i].data().data,
              id: data.docs[i].id,
              name: data.docs[i].data().name,
              type: data.docs[i].data().type,
              size: data.docs[i].data().size,
              //Assegno un altezza a caso per il rendering
              ranHeightImage:
                Math.random() < 0.5
                  ? undefined
                  : winSize.width < 900
                  ? hp("20%")
                  : hp("25%"),
            };
            try {
              item.notPrivate = data.docs[i].data().notPrivate;
            } catch (err) {}

            //se viene aggiunta una nuova immagine la metto all'inizio dellarray e poi esco dal for
            //in modo che carico solo le nuove immagini e non ripeteo il caricamento delle altre gia presenti
            if (data.docs[i].id == newPhotoId) {
              setImages((oldArray) => [item, ...oldArray]);
              i = data.docs.length;
            } else {
              setImages((oldArray) => [...oldArray, item]);
            }

            //sblocco il mutex se sono state caricate tutte le foto
            if (data.docs.length - 1 == i) {
              resolve();
            }
          } else {
            //se è gia presente l'immagine

            //sblocco il mutex se sono state caricate tutte le foto
            if (data.docs.length - 1 == i) {
              resolve();
            }
          }
        }
      }
      resolve();
    });
  };

  //Eseguito Appena si apre la pagina e quando premo pulsante reload
  React.useEffect(async () => {
    if (images.length == 0) {
      setSpinnerVisibile(true);
      setReload(true);
      aggiornaFoto().then(() => {
        mutexFoto = false;
        setSpinnerVisibile(false);
        setReload(false);
      });
    }
  }, [images]);

  //eseguito quando cambia elemento selezionato
  React.useEffect(() => {
    //per gestire il click diretto sul file o sulla cartella, senza passare per il modal
    if (elementoSelezionato.modalita == "diretta") {
      if (elementoSelezionato.size != undefined) menuSelection(1);
      else menuSelectionFolder(3);
    }
  }, [elementoSelezionato]);

  //picker immagini
  let openImagePickerAsync = async (selectedResult) => {
    //alert per scelta upload files pubblici o privati
    let response = confirm(
      "Do you want upload private (encrypted) or public (not encrypted) files? ('OK' for private, 'Cancel' for public)"
    );

    //per alert conferma caricamento tutti i file
    let errorLoading = false;

    for (let i = 0; i < selectedResult.length; i++) {
      //metto rotellina
      setReload(true);
      //metto overlay caricamneto
      setSpinnerVisibile(true);
      //per segnare durante il caricamento quale file si sta caricando
      setNumFile({ current: i + 1, total: selectedResult.length });

      //se è privato lo cifro altrimenti non lo cifro
      let filebuffer;
      if (response) {
        let enc = new TextEncoder();
        //allungo la password inserendo k perchè deve essere almeno essere lunga 16 per generare la chiave
        let passwordKey = route.params.password;
        while (passwordKey.length < 16) passwordKey += "k";

        //genero key con la password
        let key = await window.crypto.subtle.importKey(
          "raw",
          enc.encode(passwordKey),
          "AES-GCM",
          false,
          ["encrypt", "decrypt"]
        );

        //cifro il file
        filebuffer = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv: enc.encode(passwordKey) },
          key,
          await selectedResult[i].arrayBuffer()
        );
      } else {
        filebuffer = await selectedResult[i].arrayBuffer();
      }

      //levo rotellina
      setReload(false);
      //resetto la progress bar
      setProgressValue({ value: 0, total: 100 });

      //id file per il catch
      let idFile;

      try {
        /*let json;
        if ((selectedResult[i].size / 1000000).toFixed(2) < 100) {
          json = await axios.request({
            url: "https://api.web3.storage/upload",
            method: "POST",
            signal: controllerFetch.signal,
            headers: {
              Authorization: "Bearer " + config.Web3StorageToken,
            },
            data: cifrato,
            onUploadProgress: (prog) => {
              setProgressValue({ value: prog.loaded, total: prog.total });
            },
          });
        } else {
          /* let BlobCifrato = new Blob([cifrato]);
            const blockstore = new Blockstore();
            const { root: cid } = await pack({
              input: [{ path: "blob", content: BlobCifrato.stream() }],
              blockstore: blockstore,
              wrapWithDirectory: false,
            });
            const car = new BlockstoreCarReader(1, [cid], blockstore);

            const targetSize = 1024 * 1024 * 10;
            const splitter =
              car instanceof Blob
                ? await TreewalkCarSplitter.fromBlob(car, targetSize)
                : new TreewalkCarSplitter(car, targetSize);

            //li uso per la barra di caricamento
            let counterCars = 0;
            for await (const cid of splitter.cars()) {
              counterCars++;
            }
            let caricati = 0;

            const upload = transform(3, async function (car) {
              const carParts = [];
              for await (const part of car) {
                carParts.push(part);
              }
              const carFile = new Blob(carParts, { type: "application/car" });

              const response = await axios.request({
                onUploadProgress: (event) => {
                  setProgressValue({
                    value: event.loaded,
                    total: event.total,
                  });
                },
                url: /*"https://api.nft.storage/upload"*/
        /* "https://api.web3.storage/car",
                method: "POST",
                signal: controllerFetch.signal,
                headers: {
                  "content-Type": "application/car",
                  Authorization:*/
        /*"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDgyNTY0MzFEQUYwMjU4MEFENTU5NDU2NDc0OURhQWJCZTY5NWUzRjkiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY0Mjg3NjE3NTM0OCwibmFtZSI6ImRzdG9yYWdlIn0.TeG3_YYxhZeWtzpPPNxoietTB0yezr_Pqvq30yjao5w",*/
        /* "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDg3RTZiZDFhYTUyOUNmYWRmOURhMGY0NTNiMEE4ZDlGRDM3MjM2ZUIiLCJpc3MiOiJ3ZWIzLXN0b3JhZ2UiLCJpYXQiOjE2NDU0NTQ1NTcyNjUsIm5hbWUiOiJEUGhvdG8ifQ.WM4zuZ9UuGwODetDm37xMmpPLkCXXai-wAxw9Opf7Yk",
                },
                data: carFile,
              });

              return response.data.value.cid;
            });

            let root;
            for await (const cid of upload(splitter.cars())) {
              //aggiorno progresso caricamento
              caricati = caricati + 1;
              setProgressValue({ value: caricati, total: counterCars });
              root = cid;
            }

            json = cid.toString();*/

        /* let BlobCifrato = new Blob([cifrato]);
          const blockstore = new Blockstore();
          const { root: cid, out: iterable } = await pack({
            input: [{ path: "blob", content: BlobCifrato.stream() }],
            blockstore: blockstore,
            wrapWithDirectory: false,
          });
          const car = await CarReader.fromIterable(iterable);
          const targetSize = 100000000;
          const splitter = new TreewalkCarSplitter(car, targetSize);

          //li uso per la barra di caricamento
          let counterCars = Math.floor(BlobCifrato.size / targetSize);
          let caricati = 0;
          console.log(counterCars);

          const upload = transform(3, async function (smallCar) {
            const carParts = [];
            for await (const part of smallCar) {
              carParts.push(part);
            }
            const carFile = new Blob(carParts, { type: "application/car" });

            const response = await axios.request({
              url: "https://api.web3.storage/car",
              method: "POST",
              signal: controllerFetch.signal,
              headers: {
                "content-Type": "application/car",
                Authorization: "Bearer " + config.Web3StorageToken,
              },
              data: carFile,
            });
          });

          for await (const cid of upload(splitter.cars())) {
            //aggiorno progresso caricamento
            caricati = caricati + 1;
            setProgressValue({ value: caricati, total: counterCars });
          }

        json = cid.toString();
         }*/

        //carico file su web3.storage
        let caricato = 0;
        const file = new File([filebuffer], "file");
        const json = await web3s.put([file], {
          wrapWithDirectory: false,
          onStoredChunk: (size) => {
            //aggiorno lo stato del caricamento
            caricato = Math.floor(caricato + size);

            if (caricato > file.size)
              setProgressValue({ value: file.size, total: file.size });
            else setProgressValue({ value: caricato, total: file.size });
          },
          controllerFetch,
        });

        //aggiungo cid  a firebase
        let el = await addDoc(
          collection(
            db,
            "Utenti",
            route.params.email.replaceAll(".", "DOT"),
            "Photos"
          ),
          {
            cid:
              /*cid.ipnft*/ json.data == undefined
                ? json
                : json.data /*.value*/.cid,
            data: Date.now(),
            name: selectedResult[i].name,
            type:
              selectedResult[i].name.substring(
                selectedResult[i].name.lastIndexOf(".") + 1
              ) == "rar" ||
              selectedResult[i].name.substring(
                selectedResult[i].name.lastIndexOf(".") + 1
              ) == "zip"
                ? "application/zip"
                : selectedResult[i].type,
            size: selectedResult[i].size,
            dir: stackDir,
            notPrivate: !response,
          }
        );

        idFile = el.id;

        await aggiornaFoto(el.id)
          .then(() => {
            mutexFoto = false;
            setSpinnerVisibile(false);
            setReload(false);
          })
          .catch((err) => {
            mutexFoto = false;

            alert("Loading file cancelled");

            //tolgo overlay caricamneto
            setSpinnerVisibile(false);

            //annullo tutti i caricamenti in coda
            i = selectedResult.length;
          });
      } catch (err) {
        //cosi annullo tutti i caricamenti in coda
        i = selectedResult.length;

        errorLoading = true;

        try {
          //elimino da firebase
          await deleteDoc(
            doc(
              db,
              "Utenti",
              route.params.email.replaceAll(".", "DOT"),
              "Photos",
              idFile
            )
          );
        } catch (ert) {}

        controllerFetch = new AbortController();

        web3s = new Web3Storage({
          token: config.Web3StorageToken,
          abortController: controllerFetch,
        });

        console.log(err);
        alert("Loading failed");
        //tolgo overlay caricamneto
        setSpinnerVisibile(false);
        setReload(false);
      }
    }
    if (!errorLoading) alert("All files have been uploaded successfully");
  };

  let createFolder = async () => {
    let nameFolder = window.prompt("Enter the name of the folder");

    if (nameFolder != null && nameFolder != "") {
      await addDoc(
        collection(
          db,
          "Utenti",
          route.params.email.replaceAll(".", "DOT"),
          "folders"
        ),
        {
          name: nameFolder,
          data: Date.now(),
          dir: stackDir,
        }
      );

      setSpinnerVisibile(true);
      setReload(true);
      await aggiornaFoto().then(() => {
        mutexFoto = false;
        setSpinnerVisibile(false);
        setReload(false);
      });
    }
  };

  //menu al click della foto
  let menuSelection = async (value) => {
    //copy link per file pubblici
    if (value == 5) {
      copy("https://" + elementoSelezionato.cid + ".ipfs.dweb.link");

      alert("Link copied to clipboard");
    }

    //info file
    if (value == 4) {
      navigation.push("FileInfo", {
        email: route.params.email,
        name: elementoSelezionato.name,
        size: elementoSelezionato.size,
        data: elementoSelezionato.data,
        cid: elementoSelezionato.cid,
      });
    }

    //Elimina foto
    if (value == 2) {
      //elimino da firebase
      await deleteDoc(
        doc(
          db,
          "Utenti",
          route.params.email.replaceAll(".", "DOT"),
          "Photos",
          elementoSelezionato.id
        )
      );

      //elimino dallo state
      let newImages = Object.assign([], images); //si fa così per creare una copia dell'array nello stato
      newImages.splice(
        newImages.indexOf(
          newImages.filter((obj) => obj.id === elementoSelezionato.id)[0]
        ),
        1
      );
      setImages(newImages);
    }

    //Download foto
    if (value == 1) {
      if (!elementoSelezionato.notPrivate) {
        let win;

        if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
          win = window;
        else win = window.open();

        win.window.document.write(
          "<html>  <head>    <style>      html,      body {        height: 100%;        width: 100%;      }      .container {        align-items: center;        display: flex;        justify-content: center;        height: 100%;        width: 100%;      }    </style>  </head>  <body style='background-color: #191919; overflow: hidden'>    <div class='container'>      <img src='https://darchive5.web.app/static/media/logo.a7ce87a3.png' style='width: 250px' />      <div class='content'>        <p          id='textDownload'          style='color: white; font-family: Arial, Helvetica, sans-serif'        >          Download of " +
            elementoSelezionato.name +
            " in progress...        </p>      </div>    </div>  </body></html>"
        );

        //se chiudo la finestra eseguo abort del download
        win.window.addEventListener("beforeunload", (ev) => {
          controllerFetchDownload.abort();
          controllerFetchDownload = new AbortController();
        });

        axios
          .get(
            /* "https://ipfs.io/ipfs/" + elementoSelezionato.cid */ "https://" +
              elementoSelezionato.cid +
              ".ipfs.dweb.link",
            {
              signal: controllerFetchDownload.signal,
              responseType: "arraybuffer",
              onDownloadProgress: (event) => {
                win.document.getElementById("textDownload").innerHTML =
                  "Download of " +
                  elementoSelezionato.name +
                  " in progress..." +
                  " " +
                  event.loaded +
                  "/" +
                  event.total;
              },
            }
          )
          .then(async (arrayBuffer) => {
            let enc = new TextEncoder();
            //allungo la password inserendo k perchè deve essere almeno essere lunga 16 per generare la chiave
            let passwordKey = route.params.password;
            while (passwordKey.length < 16) passwordKey += "k";

            //genero key con la password
            let key = await window.crypto.subtle.importKey(
              "raw",
              enc.encode(passwordKey),
              "AES-GCM",
              false,
              ["encrypt", "decrypt"]
            );

            //decifro il file
            let decifrato = await window.crypto.subtle.decrypt(
              { name: "AES-GCM", iv: enc.encode(passwordKey) },
              key,
              arrayBuffer.data
            );

            //se è un immagine o un video lo faccio visualizzare
            //altrimenti lo scarico dandogli il nome del file giusto
            if (
              elementoSelezionato.type.includes("image") ||
              elementoSelezionato.type.includes("video")
            ) {
              let blob = new Blob([decifrato], {
                type: elementoSelezionato.type,
              });
              let url = URL.createObjectURL(blob);
              win.location.href = url;
            } else {
              //scarico il file
              var a = win.document.createElement("a");
              let blob = new Blob([decifrato], {
                type: elementoSelezionato.type,
              });
              let url = URL.createObjectURL(blob);
              a.setAttribute("href", url);
              a.setAttribute("download", elementoSelezionato.name);
              win.document.body.append(a);
              a.click();
              win.window.URL.revokeObjectURL(url);
              a.remove();
            }
          })
          .catch((err) => {
            //errore durante il download
            if (err.message != "canceled") {
              alert("Error during downloading " + elementoSelezionato.name);
              win.document.getElementById("textDownload").innerHTML =
                "Error during downloading " + elementoSelezionato.name;
            }
          });
      } else {
        let win;

        if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent))
          win = window;
        else win = window.open();

        win.window.document.write(
          "<html>  <head>    <style>      html,      body {        height: 100%;        width: 100%;      }      .container {        align-items: center;        display: flex;        justify-content: center;        height: 100%;        width: 100%;      }    </style>  </head>  <body style='background-color: #191919; overflow: hidden'>    <div class='container'>      <img src='https://darchive5.web.app/static/media/logo.a7ce87a3.png' style='width: 250px' />      <div class='content'>        <p          id='textDownload'          style='color: white; font-family: Arial, Helvetica, sans-serif'        >          Download of " +
            elementoSelezionato.name +
            " in progress...        </p>      </div>    </div>  </body></html>"
        );

        //se chiudo la finestra eseguo abort del download
        win.window.addEventListener("beforeunload", (ev) => {
          controllerFetchDownload.abort();
          controllerFetchDownload = new AbortController();
        });

        axios
          .get(
            /* "https://ipfs.io/ipfs/" + elementoSelezionato.cid */ "https://" +
              elementoSelezionato.cid +
              ".ipfs.dweb.link",
            {
              signal: controllerFetchDownload.signal,
              responseType: "arraybuffer",
              onDownloadProgress: (event) => {
                win.document.getElementById("textDownload").innerHTML =
                  "Download of " +
                  elementoSelezionato.name +
                  " in progress..." +
                  " " +
                  event.loaded +
                  "/" +
                  event.total;
              },
            }
          )
          .then(async (arrayBuffer) => {
            //scarico il file
            var a = win.document.createElement("a");
            let blob = new Blob([arrayBuffer.data], {
              type: elementoSelezionato.type,
            });
            let url = URL.createObjectURL(blob);
            a.setAttribute("href", url);
            a.setAttribute("download", elementoSelezionato.name);
            win.document.body.append(a);
            a.click();
            win.window.URL.revokeObjectURL(url);
            a.remove();
          })
          .catch((err) => {
            //errore durante il download
            if (err.message != "canceled") {
              alert("Error during downloading " + elementoSelezionato.name);
              win.document.getElementById("textDownload").innerHTML =
                "Error during downloading " + elementoSelezionato.name;
            }
          });
      }
    }

    //rinomina file
    if (value == 3) {
      let newName = window.prompt("Enter new name");
      if (newName != null && newName.trim() != "") {
        //rinomino oggetto in state
        let newImages = Object.assign([], images); //si fa così per creare una copia dell'array nello stato
        let newObject = newImages.filter(
          (obj) => obj.id === elementoSelezionato.id
        )[0];
        let estenzione = newObject.name.slice(newObject.name.lastIndexOf("."));
        newObject.name = newName.trim() + estenzione;
        newImages[
          newImages.indexOf(
            newImages.filter((obj) => obj.id === elementoSelezionato.id)[0]
          )
        ] = newObject;
        setImages(newImages);

        //rinomino su firebase
        await updateDoc(
          doc(
            db,
            "Utenti",
            route.params.email.replaceAll(".", "DOT"),
            "Photos",
            elementoSelezionato.id
          ),
          { name: newName.trim() + estenzione }
        );
      }
    }
  };

  //menu al click della cartella
  let menuSelectionFolder = async (value) => {
    //Elimina folder
    if (value == 2) {
      //controllo se la cartella contiene cartelle
      let controllo1 = await getDocs(
        query(
          collection(
            db,
            "Utenti",
            route.params.email.replaceAll(".", "DOT"),
            "folders"
          ),
          where("dir", "array-contains", elementoSelezionato.id)
        )
      );

      //controllo se la cartella contiene file
      let controllo2 = await getDocs(
        query(
          collection(
            db,
            "Utenti",
            route.params.email.replaceAll(".", "DOT"),
            "Photos"
          ),
          where("dir", "array-contains", elementoSelezionato.id)
        )
      );

      //elimino se la cartella è vuota
      if (controllo1.size == 0 && controllo2.size == 0) {
        //elimino da firebase
        await deleteDoc(
          doc(
            db,
            "Utenti",
            route.params.email.replaceAll(".", "DOT"),
            "folders",
            elementoSelezionato.id
          )
        );

        //elimino dallo state
        let newFolders = Object.assign([], folders); //si fa così per creare una copia dell'array nello stato
        newFolders.splice(
          newFolders.indexOf(
            newFolders.filter((obj) => obj.id === elementoSelezionato.id)[0]
          ),
          1
        );
        setFolders(newFolders);
      } else {
        alert("The folder must be empty");
      }
    }

    //apro cartella
    if (value == 3) {
      setStackDir((oldStack) => [...oldStack, elementoSelezionato.id]);

      setImages([]);
    }

    //rinomino cartella
    if (value == 1) {
      let newName = window.prompt("Enter new name");
      if (newName != null && newName.trim() != "") {
        //rinomino oggetto in state
        let newFolders = Object.assign([], folders); //si fa così per creare una copia dell'array nello stato
        let newObject = newFolders.filter(
          (obj) => obj.id === elementoSelezionato.id
        )[0];
        newObject.name = newName.trim();
        newFolders[
          newFolders.indexOf(
            newFolders.filter((obj) => obj.id === elementoSelezionato.id)[0]
          )
        ] = newObject;
        setFolders(newFolders);

        //rinomino su firebase
        await updateDoc(
          doc(
            db,
            "Utenti",
            route.params.email.replaceAll(".", "DOT"),
            "folders",
            elementoSelezionato.id
          ),
          { name: newName.trim() }
        );
      }
    }
  };

  ///////////////RENDER IMMAGINI/////////////////////////////////////
  const Item = ({ data, cid, id, name, size, type, notPrivate }) => {
    return (
      //Menu  compare alla pressione dell'immagine
      <TouchableOpacity
        onPress={() => {
          setElementoSelezionato({
            id: id,
            cid: cid,
            type: type,
            name: name,
            size: size,
            data: data,
            notPrivate: notPrivate,
            modalita: "diretta",
          });
        }}
      >
        <View
          style={{
            padding: winSize.width < 900 ? hp("2%") : hp("3%"),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/*Immagine */}
            <Image
              source={
                notPrivate
                  ? require("./assets/filePublic.png")
                  : require("./assets/file.png")
              }
              cacheKey={cid}
              style={{
                width: "90px",
                aspectRatio: 0.7,
                height: "110px",
                borderRadius: hp("5%"),
                alignSelf: "stretch",
              }}
            />

            {/*nome file */}
            <Text
              style={{
                color: "white",
                width: "25%",
                fontWeight: "bold",
                marginLeft: "3%",
              }}
            >
              {name}
            </Text>

            {/*size  + data*/}
            <Text
              style={{
                color: "white",
                width: "25%",
                fontWeight: 200,
                marginLeft: "10%",
              }}
            >
              {"Size : " +
                (size / 1000000).toFixed(2) +
                "MB Loading date: " +
                new Date(data).toLocaleString()}
            </Text>

            {/*Icona per aprire impostazioni file */}
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={() => {
                  setElementoSelezionato({
                    id: id,
                    cid: cid,
                    type: type,
                    name: name,
                    size: size,
                    data: data,
                    notPrivate: notPrivate,
                  });
                  setValueModal(1);
                }}
              >
                <Icon name="dots-vertical" color={"white"} size={30} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => (
    <Item
      data={item.data}
      cid={item.cid}
      id={item.id}
      name={item.name}
      size={item.size}
      type={item.type}
      notPrivate={item.notPrivate}
    />
  );

  //////////////////////////////////////////////////////////////////

  ///////////////RENDER Cartelle/////////////////////////////////////
  const Itemfolder = ({ id, data, name }) => {
    return (
      //Menu  compare alla pressione dell'immagine
      <TouchableOpacity
        onPress={() => {
          setElementoSelezionato({
            id: id,
            modalita: "diretta",
          });
        }}
        style={{
          padding: winSize.width < 900 ? hp("2%") : hp("3%"),
        }}
      >
        <View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {/*Immagine */}
            <Image
              source={require("./assets/folder.png")}
              cacheKey={name}
              style={{
                width: "90px",
                aspectRatio: 0.7,
                height: "110px",
                borderRadius: hp("5%"),
                alignSelf: "stretch",
              }}
            />
            <Text
              style={{
                color: "white",
                width: "25%",
                fontWeight: "bold",
                marginLeft: "3%",
              }}
            >
              {name}
            </Text>
            <Text
              style={{
                color: "white",
                width: "25%",
                fontWeight: 200,
                marginLeft: "10%",
              }}
            >
              {"Creation date: " + new Date(data).toLocaleString()}
            </Text>

            {/*Icona per aprire impostazioni file */}
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={() => {
                  setElementoSelezionato({
                    name: name,
                    id: id,
                  });
                  setValueModal(2);
                }}
              >
                <Icon name="dots-vertical" color={"white"} size={30} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItemFolder = ({ item }) => (
    <Itemfolder id={item.id} data={item.data} name={item.name} />
  );

  //////////////////////////////////////////////////////////////////

  return (
    <View
      style={{
        width: "flex",
        height: "100%",
        backgroundColor: "#191919",
        alignItems: "center",
      }}
    >
      {/*Modal opzioni file */}
      <Modal visible={valueModal == 1 ? true : false} transparent={true}>
        <View
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <View
            style={{
              backgroundColor: "#2b2b2b",
              borderRadius: "5%",
              width: winSize.width > 900 ? "50%" : "80%",
              height: winSize.width > 900 ? "70%" : "70%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/*Nome file */}
            <Text
              style={{
                textAlign: "center",
                color: "white",
                fontWeight: "100",
                fontSize: "30px",
                width: "80%",
              }}
            >
              {elementoSelezionato.name}
            </Text>

            {/*Tasto download */}
            <TouchableOpacity
              onPress={() => {
                menuSelection(1);
                setValueModal(0);
              }}
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
            >
              <Text style={{ color: "white", fontSize: "25px" }}>Download</Text>
            </TouchableOpacity>

            {elementoSelezionato.notPrivate != undefined &&
            elementoSelezionato.notPrivate == true ? (
              //tasto copy link
              <TouchableOpacity
                onPress={() => {
                  menuSelection(5);
                  setValueModal(0);
                }}
                style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              >
                <Text style={{ color: "white", fontSize: "25px" }}>
                  Copy link
                </Text>
              </TouchableOpacity>
            ) : null}

            {/*Tasto rename */}
            <TouchableOpacity
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              onPress={() => {
                menuSelection(3);
                setValueModal(0);
              }}
            >
              <Text style={{ color: "white", fontSize: "25px" }}>Rename</Text>
            </TouchableOpacity>

            {/*Tasto Info */}
            <TouchableOpacity
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              onPress={() => {
                menuSelection(4);
                setValueModal(0);
              }}
            >
              <Text style={{ color: "white", fontSize: "25px" }}>Info</Text>
            </TouchableOpacity>

            {/*Tasto delete */}
            <TouchableOpacity
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              onPress={() => {
                menuSelection(2);
                setValueModal(0);
              }}
            >
              <Text style={{ color: "red", fontSize: "25px" }}>Delete</Text>
            </TouchableOpacity>

            {/*Tasto chiudere modal */}
            <TouchableOpacity
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              onPress={() => {
                setValueModal(0);
              }}
            >
              <Icon name="close" color={"#ff5c5c"} size={30} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/*Modal opzioni folders */}
      <Modal visible={valueModal == 2 ? true : false} transparent={true}>
        <View
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
          }}
        >
          <View
            style={{
              backgroundColor: "#2b2b2b",
              borderRadius: "5%",
              width: winSize.width > 900 ? "50%" : "80%",
              height: winSize.width > 900 ? "50%" : "60%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/*Nome file */}
            <Text
              style={{
                textAlign: "center",
                color: "white",
                fontWeight: "100",
                fontSize: "30px",
                width: "80%",
              }}
            >
              {elementoSelezionato.name}
            </Text>

            {/*Tasto Open */}
            <TouchableOpacity
              onPress={() => {
                menuSelectionFolder(3);
                setValueModal(0);
              }}
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
            >
              <Text style={{ color: "white", fontSize: "25px" }}>Open</Text>
            </TouchableOpacity>

            {/*Tasto rename */}
            <TouchableOpacity
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              onPress={() => {
                menuSelectionFolder(1);
                setValueModal(0);
              }}
            >
              <Text style={{ color: "white", fontSize: "25px" }}>Rename</Text>
            </TouchableOpacity>

            {/*Tasto delete */}
            <TouchableOpacity
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              onPress={() => {
                menuSelectionFolder(2);
                setValueModal(0);
              }}
            >
              <Text style={{ color: "red", fontSize: "25px" }}>Delete</Text>
            </TouchableOpacity>

            {/*Tasto chiudere modal */}
            <TouchableOpacity
              style={{ marginTop: winSize.width > 900 ? "3%" : "7%" }}
              onPress={() => {
                setValueModal(0);
              }}
            >
              <Icon name="close" color={"#ff5c5c"} size={30} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/*Floating menu */}
      <FloatingMenu
        position="top-left"
        iconColor={"#ff5c5c"}
        borderColor={"#ff5c5c"}
        backgroundDownColor={"#ff5c5c"}
        isOpen={menuOpen}
        items={[
          { label: "Info" },
          { label: "Reload" },
          { label: "Create new folder" },
          { label: "Upload" },
        ]}
        onMenuToggle={() => {
          setMenuOpen(!menuOpen);
        }}
        onItemPress={(item, index) => {
          if (index == 0) {
            document.getElementById("fileLoad").click();
            setMenuOpen(false);
          }
          if (index == 1) {
            createFolder();
            setMenuOpen(false);
          }
          if (index == 2) {
            setImages([]);
            setMenuOpen(false);
          }
          if (index == 3) {
            navigation.push("Settings", {
              email: route.params.email,
              password: route.params.password,
            });
          }
        }}
        renderItemIcon={(item, index) => {
          if (index == 0)
            return (
              <Icon name="file-document-outline" color={"#ff5c5c"} size={20} />
            );
          if (index == 1)
            return (
              <Icon name="folder-plus-outline" color={"#ff5c5c"} size={20} />
            );
          if (index == 2)
            return <Icon name="reload" color={"#ff5c5c"} size={20} />;
          if (index == 3)
            return (
              <Icon name="information-outline" color={"#ff5c5c"} size={20} />
            );
        }}
      />
      {/*overlay loading */}
      <Spinner
        visible={spinnerVisible}
        textStyle={{ color: "white" }}
        children={
          <View
            style={{
              width: "100%",
              height: "100%",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/*Spinner */}
            {reload ? (
              <ActivityIndicator
                color={"white"}
                size={"large"}
              ></ActivityIndicator>
            ) : (
              <View
                style={{
                  height: "40%",
                  borderRadius: hp("5%"),
                  backgroundColor: "#2b2b2b",
                  width: winSize.width < 900 ? "70%" : "30%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {/*Testo numero file in caricamento */}
                <Text
                  style={{
                    fontWeight: 200,
                    color: "white",
                    fontWeight: "bold",
                    marginBottom: "8%",
                  }}
                >
                  {"Loading file " + numFile.current + " of " + numFile.total}
                </Text>

                {/*Testo progress bar */}
                <Text style={{ fontWeight: 200, color: "white" }}>
                  {Math.floor(
                    (progressValue.value / progressValue.total) * 100
                  ) +
                    " / " +
                    100}
                </Text>

                {/*Progress bar */}
                <Progress.Bar
                  style={{ backgroundColor: "white" }}
                  progress={progressValue.value / progressValue.total}
                  width={200}
                  color="black"
                />

                {/*Tasto annulla caricamento lo mostro solo se è un caricamento di aggiunta foto*/}
                <TouchableOpacity
                  style={{
                    backgroundColor: "#ff5c5c",
                    width: "150px",
                    height: "50px",
                    marginTop: hp("5%"),
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                  onPress={() => {
                    controllerFetch.abort();
                  }}
                >
                  <View>
                    <Text style={{ color: "white" }}>Cancelled</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        }
      />

      {/*Logo */}
      <Image
        resizeMode="center"
        style={{
          width: winSize.width / 2,
          height: "250px",
          marginTop: "-20px",
        }}
        source={{ uri: require("./assets/logo.png") }}
      ></Image>

      {/*Nome e cognome utente */}
      <Text
        style={{
          color: "white",
          fontSize:
            winSize.width < 900 ? winSize.width / 30 : winSize.width / 40,
          fontWeight: "400",
          marginTop: hp("-2%"),
        }}
      >
        {route.params.email}
      </Text>

      {/*Pulsante aggiunta foto */}
      <input
        onChange={async (event) => {
          await openImagePickerAsync(event.target.files);
          event.target.value = "";
        }}
        id="fileLoad"
        type="file"
        accept="*"
        style={{ display: "none" }}
        multiple={true}
      />
      <label for="fileLoad"></label>

      <View
        style={{
          width: "100%",
          justifyContent: "center",
          flexDirection: "row",
          height: "5%",
          marginTop: hp("3%"),
          alignItems: "center",
        }}
      >
        {/*Tatso logout */}
        <TouchableOpacity
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
          onPress={async () => {
            await AsyncStorage.clear();
            signOut(auth);
            navigation.push("LogIn");
          }}
        >
          <Icon name="exit-to-app" color={"white"} size={30} />
          <Text style={{ color: "white", fontWeight: 200 }}>Logout</Text>
        </TouchableOpacity>

        {/*Pulsante back */}
        {stackDir[stackDir.length - 1] != "Photos" ? (
          <TouchableOpacity
            style={{
              justifyContent: "center",
              alignItems: "center",
              marginLeft: "50px",
            }}
            onPress={() => {
              if (stackDir.length != 1) {
                //ritorno alla dir precedente
                let newStack = Object.assign([], stackDir); //si fa così per creare una copia dell'array nello stato
                newStack.pop();
                setStackDir(newStack);

                //attiverà useEffect
                setImages([]);
              }
            }}
          >
            <Icon name="keyboard-backspace" color={"white"} size={30} />
            <Text style={{ color: "white", fontWeight: 200 }}>Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={{
          marginTop: "20px",
          width: "100%",
          backgroundColor: "#2b2b2b",
          borderTopLeftRadius: "50px",
          borderTopRightRadius: "50px",
        }}
      >
        {folders.length == 0 && images.length == 0 ? (
          <View
            style={{
              width: "100%",
              alignItems: "center",
              justifyContent: "center",
              height: winSize.height / 2,
            }}
          >
            {/*Icona empty folder */}
            <Icon name="folder-plus-outline" color={"#757575"} size={50} />
            <Text style={{ color: "#757575", fontWeight: 200 }}>
              Empty folder
            </Text>
          </View>
        ) : (
          <View>
            <View style={{ width: "100%" }}>
              {/*Container folders */}
              <FlatList
                numColumns={1}
                data={folders}
                renderItem={renderItemFolder}
                keyExtractor={(itemFolders) => itemFolders.id}
              />
            </View>
            <View style={{ width: "100%" }}>
              {/*Container photo */}
              <FlatList
                numColumns={1}
                data={images}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default Home;