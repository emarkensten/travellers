'use client'

import { useState, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle, ChevronRight, AlertCircle, Upload } from 'lucide-react'
import { Label } from "@/components/ui/label"
import toast from 'react-hot-toast'
import { Progress } from "@/components/ui/progress"
import { z } from 'zod';
import { useDropzone } from 'react-dropzone'
import axios from 'axios';

type Traveller = {
  id: number
  firstName: string
  lastName: string
  dateOfBirth: string
  nationality: string
  gender: string
  disability: string
  memberNumber: string
  isComplete: boolean
}

const mapToSwedish = (value: string, field: 'gender' | 'nationality' | 'disability'): string => {
  const mappings = {
    gender: {
      'male': 'Man',
      'female': 'Kvinna',
      'other': 'Annat'
    },
    nationality: {
      'Swedish': 'Sverige',
      'Norwegian': 'Norge',
      'Danish': 'Danmark',
      'Finnish': 'Finland',
      'Unknown': '' // Map 'Unknown' to an empty string
    },
    disability: {
      'None': 'Inget funktionshinder',
      'Mobility impairment': 'Rörelsehinder',
      'Visual impairment': 'Synskada',
      'Hearing impairment': 'Hörselskada'
    }
  };

  return mappings[field][value as keyof typeof mappings[typeof field]] || value;
};

export function TravellerEditInterface() {
  const [travellers, setTravellers] = useState<Traveller[]>([
    { id: 1, firstName: '', lastName: '', dateOfBirth: '', nationality: '', gender: '', disability: '', memberNumber: '', isComplete: false },
    { id: 2, firstName: '', lastName: '', dateOfBirth: '', nationality: '', gender: '', disability: '', memberNumber: '', isComplete: false },
    { id: 3, firstName: '', lastName: '', dateOfBirth: '', nationality: '', gender: '', disability: '', memberNumber: '', isComplete: false },
    { id: 4, firstName: '', lastName: '', dateOfBirth: '', nationality: '', gender: '', disability: '', memberNumber: '', isComplete: false },
    { id: 5, firstName: '', lastName: '', dateOfBirth: '', nationality: '', gender: '', disability: '', memberNumber: '', isComplete: false },
  ])
  const [selectedTraveller, setSelectedTraveller] = useState<Traveller | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')

  // Define the schema for a single traveller
  const TravellerSchema = z.object({
    firstName: z.string(),
    lastName: z.string(),
    dateOfBirth: z.string(),
    gender: z.string(),
    nationality: z.string(),
    disability: z.string().optional(),
  });

  // Define the schema for the entire response
  const TravellerResponseSchema = z.object({
    travellers: z.array(TravellerSchema),
    globalInfo: z.object({
      nationality: z.string().optional(),
      disability: z.string().optional(),
    }),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      handleFileUpload(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  });

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);
    setProgressText('Starting file processing...');

    try {
      console.log('File upload started:', file.name);
      setProgress(10);
      setProgressText('Uploading file...');

      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('/api/process-travellers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total ?? 1));
          setProgress(10 + percentCompleted * 0.6); // 10% to 70%
          setProgressText(`Uploading: ${percentCompleted}%`);
        },
      });

      console.log('Received response from OpenAI API');
      setProgress(80);
      setProgressText('Processing AI response...');

      if (response.data.refusal) {
        throw new Error(response.data.refusal);
      }

      const data = response.data;
      console.log('Received data:', data);

      setProgress(90);
      setProgressText('Updating traveller information...');

      setTravellers(prevTravellers => {
        if (!data || !data.travellers || !Array.isArray(data.travellers)) {
          console.error('Invalid data structure received from AI:', data);
          toast.error("Received invalid data from AI. Please try again.");
          return prevTravellers;
        }

        const updatedTravellers = prevTravellers.map((traveller, index) => {
          if (index < data.travellers.length) {
            const travellerData = data.travellers[index];
            const updatedTraveller = {
              ...traveller,
              firstName: travellerData.firstName || traveller.firstName,
              lastName: travellerData.lastName || traveller.lastName,
              dateOfBirth: travellerData.dateOfBirth || traveller.dateOfBirth,
              gender: mapToSwedish(travellerData.gender, 'gender') || traveller.gender,
              nationality: mapToSwedish(travellerData.nationality || data.globalInfo?.nationality, 'nationality') || traveller.nationality,
              disability: mapToSwedish(travellerData.disability || data.globalInfo?.disability, 'disability') || traveller.disability,
            };

            // If nationality is still 'Unknown' after mapping, set it to an empty string
            if (updatedTraveller.nationality === 'Unknown') {
              updatedTraveller.nationality = '';
            }

            updatedTraveller.isComplete = isCompleted(updatedTraveller);
            return updatedTraveller;
          }
          return traveller;
        });
        console.log('All updated travellers:', updatedTravellers);
        return updatedTravellers;
      });

      console.log('Traveller information updated');
      setProgress(100);
      setProgressText('Processing complete!');
      toast.success("Traveller information updated");

    } catch (error) {
      console.error('Error processing file:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error || error.message;
        console.error('Detailed error:', errorMessage);
        toast.error(`Failed to process the file: ${errorMessage}`);
      } else if (error instanceof Error) {
        console.error('Detailed error:', error.message, error.stack);
        toast.error(error.message);
      } else {
        toast.error("Failed to process the file. Please try again.");
      }
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setProgressText('');
      }, 2000); // Keep the progress visible for 2 seconds after completion
    }
  };

  // Helper function to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleEditTraveller = (traveller: Traveller) => {
    setSelectedTraveller({...traveller}); // Create a new object to ensure state update
    setIsSheetOpen(true);
  }

  const handleSaveTraveller = () => {
    if (selectedTraveller) {
      setTravellers(prevTravellers => 
        prevTravellers.map(t => 
          t.id === selectedTraveller.id 
            ? { ...selectedTraveller, isComplete: isCompleted(selectedTraveller) } 
            : t
        )
      )
      console.log('Traveller saved:', selectedTraveller)
      setIsSheetOpen(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedTraveller) {
      setSelectedTraveller({ ...selectedTraveller, [e.target.name]: e.target.value })
    }
  }

  const isCompleted = (traveller: Traveller) => {
    return Boolean(
      traveller.firstName && 
      traveller.lastName && 
      traveller.dateOfBirth && 
      traveller.nationality && 
      traveller.nationality !== 'Unknown' && // Add this check
      traveller.gender &&
      traveller.disability !== undefined
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Uppgifter om resenärer</h1>
      <div className="space-y-2">
        {travellers.map((traveller) => (
          <Card key={traveller.id} className="cursor-pointer" onClick={() => handleEditTraveller(traveller)}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center">
                {traveller.isComplete ? (
                  <CheckCircle className="w-6 h-6 text-green-500 mr-2" />
                ) : null}
                <span>{traveller.firstName} {traveller.lastName || 'Vuxen 18+'} {traveller.nationality && `(${traveller.nationality})`}</span>
              </div>
              <ChevronRight className="w-6 h-6" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <div {...getRootProps()} className={`cursor-pointer ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-center w-full p-4 text-center border-2 border-dashed rounded-md hover:bg-gray-50">
            <input {...getInputProps()} />
            <div>
              <Upload className="w-8 h-8 mx-auto mb-2" />
              <span className="text-sm font-semibold">
                {isDragActive ? 'Släpp filen här' : 'Fyll i med AI'}
              </span>
              <p className="mt-1 text-xs text-gray-500">
                Dra och släpp en fil här, eller klicka för att välja en fil
              </p>
              <p className="mt-1 text-xs text-gray-500">
                (Text, Excel, Csv, Word, PDF, eller bild)
              </p>
            </div>
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="mt-4">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-center mt-2">{progressText}</p>
        </div>
      )}

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] bg-white !bg-opacity-100">
          <SheetHeader>
            <SheetTitle>Ändra uppgifter för Vuxen 18+</SheetTitle>
            <SheetDescription>
              Enligt lag behöver vi fråga om namn och födelsedatum på alla resenärer.
            </SheetDescription>
          </SheetHeader>
          {selectedTraveller && (
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Förnamn <span className="text-red-500">*</span></Label>
                <Input 
                  id="firstName"
                  name="firstName" 
                  value={selectedTraveller.firstName} 
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Efternamn <span className="text-red-500">*</span></Label>
                <Input 
                  id="lastName"
                  name="lastName" 
                  value={selectedTraveller.lastName} 
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Födelsedatum (8 siffror ÅÅÅÅMMDD) <span className="text-red-500">*</span></Label>
                <Input 
                  id="dateOfBirth"
                  name="dateOfBirth" 
                  value={selectedTraveller.dateOfBirth} 
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nationality">Nationalitet <span className="text-red-500">*</span></Label>
                <Select 
                  value={selectedTraveller.nationality}
                  onValueChange={(value) => setSelectedTraveller({...selectedTraveller, nationality: value})}
                >
                  <SelectTrigger id="nationality">
                    <SelectValue placeholder="Välj nationalitet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sverige">Sverige</SelectItem>
                    <SelectItem value="Norge">Norge</SelectItem>
                    <SelectItem value="Danmark">Danmark</SelectItem>
                    <SelectItem value="Finland">Finland</SelectItem>
                    <SelectItem value="Annat">Annat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Kön <span className="text-red-500">*</span></Label>
                <Select
                  value={selectedTraveller.gender}
                  onValueChange={(value) => setSelectedTraveller({...selectedTraveller, gender: value})}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Välj kön" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Man">Man</SelectItem>
                    <SelectItem value="Kvinna">Kvinna</SelectItem>
                    <SelectItem value="Annat">Annat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="disability">Funktionshinder</Label>
                <Select
                  value={selectedTraveller.disability}
                  onValueChange={(value) => setSelectedTraveller({...selectedTraveller, disability: value})}
                >
                  <SelectTrigger id="disability">
                    <SelectValue placeholder="Välj funktionshinder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inget funktionshinder">Inget funktionshinder</SelectItem>
                    <SelectItem value="Rörelsehinder">Rörelsehinder</SelectItem>
                    <SelectItem value="Synskada">Synskada</SelectItem>
                    <SelectItem value="Hörselskada">Hörselskada</SelectItem>
                    <SelectItem value="Annat">Annat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="memberNumber">Medlemsnummer</Label>
                <Input 
                  id="memberNumber"
                  name="memberNumber" 
                  value={selectedTraveller.memberNumber} 
                  onChange={handleInputChange}
                />
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4 mr-2" />
                <span>Fält markerade med * är obligatoriska</span>
              </div>
              <Button onClick={handleSaveTraveller} className="w-full">Spara uppgifter</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}