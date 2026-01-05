> the login form have some problems with the title , subtitle etc... they are
> not in good  
>  shape and it's not showing them clearly i only saw the 50% of each character

also it has some  
 problem like , 1st- Property 'onSurfaceVariant' does not exist on type '{
readonly base: { readonly  
 primary: { readonly 50: "#E8F5E8"; readonly 100: "#C8E6C8"; readonly 200:
"#A5D6A5"; readonly  
 300: "#81C784"; readonly 400: "#66BB6A"; readonly 500: "#4CAF50"; readonly 600:
"#43A047";  
 readonly 700: "#388E3C"; readonly 800: "#2E7D32"; readonly 900: "#1B5E20"; };
... 5 more ...;  
 readonly ,

2nd- Property 'success' does not exist on type '{ readonly base: { readonly
primary: {  
 readonly 50: "#E8F5E8"; readonly 100: "#C8E6C8"; readonly 200: "#A5D6A5";
readonly 300: "#81C784"; readonly 400: "#66BB6A"; readonly 500: "#4CAF50";
readonly 600: "#43A047"; readonly  
 700: "#388E3C"; readonly 800: "#2E7D32"; readonly 900: "#1B5E20"; }; ... 5 more
...; readonly  
 n...'.ts(2339)

3rd- Type '{ label: string; value: string; onChangeText: (value: string) =>
void; onBlur: () => void; placeholder: string; type: "email"; required: true;
disabled: boolean; errorText: string | undefined; autoFocus: boolean; testID:
string; }' is not assignable to type 'IntrinsicAttributes & FormFieldProps' with
'exactOptionalPropertyTypes: true'. Consider adding 'undefined' to the types of
the target's properties. Property 'autoFocus' does not exist on type
'IntrinsicAttributes & FormFieldProps

4th- Type '{ label: string; value: string; onChangeText: (value: string) =>
void; onBlur: () => void; placeholder: string; type: "password"; required: true;
disabled: boolean; errorText: string | undefined; testID: string; }' is not
assignable to type 'FormFieldProps' with 'exactOptionalPropertyTypes: true'.
Consider adding 'undefined' to the types of the target's properties. Types of
property 'errorText' are incompatible. Type 'string | undefined' is not
assignable to type 'string'. Type 'undefined' is not assignable to type
'string'.ts(2375)

5th- Property 'primary' does not exist on type '{ readonly base: { readonly
primary: { readonly 50: "#E8F5E8"; readonly 100: "#C8E6C8"; readonly 200:
"#A5D6A5"; readonly 300: "#81C784"; readonly 400: "#66BB6A"; readonly 500:
"#4CAF50"; readonly 600: "#43A047"; readonly 700: "#388E3C"; readonly 800:
"#2E7D32"; readonly 900: "#1B5E20"; }; ... 5 more ...; readonly n...'.ts(2339)

6st- Property 'outline' does not exist on type '{ readonly base: { readonly
primary: { readonly 50: "#E8F5E8"; readonly 100: "#C8E6C8"; readonly 200:
"#A5D6A5"; readonly 300: "#81C784"; readonly 400: "#66BB6A"; readonly 500:
"#4CAF50"; readonly 600: "#43A047"; readonly 700: "#388E3C"; readonly 800:
"#2E7D32"; readonly 900: "#1B5E20"; }; ... 5 more ...; readonly n...'.ts(2339)

7th- No overload matches this call. Overload 1 of 2, '(props: ViewProps): View',
gave the following error. Type 'string' is not assignable to type
'AccessibilityRole | undefined'. Overload 2 of 2, '(props: ViewProps, context:
any): View', gave the following error. Type 'string' is not assignable to type
'AccessibilityRole | undefined'.ts(2769) ViewAccessibility.d.ts(44, 3): The
expected type comes from property 'accessibilityRole' which is declared here on
type 'IntrinsicAttributes & IntrinsicClassAttributes<View> &
Readonly<ViewProps>' ViewAccessibility.d.ts(44, 3): The expected type comes from
property 'accessibilityRole' which is declared here on type 'IntrinsicAttributes
& IntrinsicClassAttributes<View> & Readonly<ViewProps>'
